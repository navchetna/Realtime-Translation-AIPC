import { useState, useCallback, useEffect, useRef } from 'react';
import styles from './App.module.css';
import { Sidebar } from './components/Sidebar';
import { TranslationPanel } from './components/TranslationPanel';
import { VADController } from './components/VADController';
import { Activity, MicOff, Loader2, AlertCircle, FileText } from 'lucide-react';
import { ENABLE_SENTENCE_COMPLETENESS_BUFFER, MIN_TRANSCRIPT_BUFFER_WORDS, PREDEFINED_SUMMARY_TEXT } from './config/appConfig';
import { TranslationService } from './services/TranslationService';
import { TtsService, TTS_SUPPORTED_LANGUAGES } from './services/TtsService';
import type { NmtMetrics } from './services/TranslationService';
import type { AsrMetrics } from './services/AsrService';
import type { TtsMetrics } from './services/TtsService';

const STREAMABLE_LANGUAGES = [...TTS_SUPPORTED_LANGUAGES];
const MAX_STREAM_AUDIO_QUEUE = 6;
const STREAM_AUDIO_SETTINGS_KEY = 'realtime-translation:stream-audio-settings';

type StreamAudioItem = {
  text: string;
  language: string;
  forcePlayback?: boolean;
};

type AudioPlaybackItem = {
  audioBlob: Blob;
  metrics: TtsMetrics | null;
};

function App() {
  const [vadReady, setVadReady] = useState(false);
  const [vadError, setVadError] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [isTranslating, setIsTranslating] = useState(false);
  const [panelCount, setPanelCount] = useState(2);
  const [panelTargets, setPanelTargets] = useState<Record<string, string>>({
    'panel-1': 'Hindi',
    'panel-2': 'English',
  });
  const [panelTranslations, setPanelTranslations] = useState<Record<string, string>>({
    'panel-1': '',
    'panel-2': '',
  });
  const [isStreamAudioEnabled, setIsStreamAudioEnabled] = useState(false);
  const [streamAudioLanguage, setStreamAudioLanguage] = useState<string>('Hindi');
  const [streamAudioQueueSize, setStreamAudioQueueSize] = useState(0);
  const [isStreamingAudioActive, setIsStreamingAudioActive] = useState(false);
  const [hasUnsavedStreamAudioSettings, setHasUnsavedStreamAudioSettings] = useState(false);
  const [streamAudioSettingsMessage, setStreamAudioSettingsMessage] = useState('');
  const MAX_TRANSLATION_LINES = 40;
  const MAX_TRANSLATION_QUEUE = 8;
  const translationQueueRef = useRef<string[]>([]);
  const isTranslationQueueRunningRef = useRef(false);
  const pendingTranscriptBufferRef = useRef('');
  const lastQueuedTranscriptRef = useRef('');
  const panelTargetsRef = useRef(panelTargets);
  const isStreamAudioEnabledRef = useRef(isStreamAudioEnabled);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioUrlRef = useRef<string | null>(null);
  const activeStreamAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeStreamAudioUrlRef = useRef<string | null>(null);
  const streamAudioQueueRef = useRef<StreamAudioItem[]>([]);
  const isStreamQueueRunningRef = useRef(false);
  const MAX_AUDIO_PLAYBACK_QUEUE = 10;
  const audioPlaybackQueueRef = useRef<AudioPlaybackItem[]>([]);
  const isAudioPlaybackRunningRef = useRef(false);
  const [audioPlaybackQueueSize, setAudioPlaybackQueueSize] = useState(0);
  const processedStreamLineCountsRef = useRef<Record<string, number>>({});

  const [, setLastAsrMetrics] = useState<AsrMetrics | null>(null);
  const [, setLastNmtMetrics] = useState<NmtMetrics | null>(null);
  const [, setLastTtsMetrics] = useState<TtsMetrics | null>(null);

  const availableStreamAudioLanguages = Array.from(
    new Set(
      Object.values(panelTargets).filter((language) =>
        STREAMABLE_LANGUAGES.includes(language as typeof STREAMABLE_LANGUAGES[number])
      )
    )
  );

  const addLog = useCallback((msg: string) => {
    if (msg.startsWith('✓')) {
      setVadReady(true);
      setVadError(false);
    }
    if (msg.startsWith('✗')) {
      setVadError(true);
      setVadReady(false);
      setIsListening(false);
      setIsSpeaking(false);
    }
  }, []);

  const appendChunk = useCallback((existing: string, nextChunk: string) => {
    if (!nextChunk.trim()) return existing;
    const combined = existing ? `${existing}\n${nextChunk}` : nextChunk;
    const lines = combined.split('\n').filter(line => line.trim().length > 0);
    return lines.slice(-MAX_TRANSLATION_LINES).join('\n');
  }, []);

  const pumpTranslationQueue = useCallback(() => {
    if (isTranslationQueueRunningRef.current) {
      return;
    }

    const sourceTranscript = translationQueueRef.current.shift();
    if (!sourceTranscript) {
      setIsTranslating(false);
      return;
    }

    isTranslationQueueRunningRef.current = true;
    setIsTranslating(true);

    const currentTargets = { ...panelTargetsRef.current };

    TranslationService.translateBatch(
      sourceTranscript,
      Object.values(currentTargets),
      'en'
    )
      .then(({ results: languageResults, metrics: nmtMetrics }) => {
        if (nmtMetrics) setLastNmtMetrics(nmtMetrics);

        setPanelTranslations(prev => {
          const updated: Record<string, string> = { ...prev };
          for (const panelId of Object.keys(currentTargets)) {
            updated[panelId] = appendChunk(prev[panelId] || '', languageResults[currentTargets[panelId]] || '');
          }
          return updated;
        });
      })
      .catch((error) => {
        console.warn('Sequential NMT queue item failed:', error);
      })
      .finally(() => {
        isTranslationQueueRunningRef.current = false;
        pumpTranslationQueue();
      });
  }, [appendChunk]);

  const getWordCount = useCallback((text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }, []);

  const hasSentenceEnd = useCallback((text: string) => {
    return /[.!?…।]\s*$/.test(text.trim());
  }, []);

  const endsAbruptly = useCallback((text: string) => {
    const incompleteEndings = new Set([
      'and', 'or', 'but', 'so', 'because', 'if', 'then',
      'the', 'a', 'an', 'to', 'of', 'in', 'on', 'for', 'with'
    ]);

    const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const lastWord = words[words.length - 1];
    return !!lastWord && incompleteEndings.has(lastWord);
  }, []);

  const isCompleteSentence = useCallback((text: string) => {
    const normalized = text.trim();
    if (!normalized) return false;
    if (getWordCount(normalized) < MIN_TRANSCRIPT_BUFFER_WORDS) return false;
    if (!hasSentenceEnd(normalized)) return false;
    if (endsAbruptly(normalized)) return false;
    return true;
  }, [endsAbruptly, getWordCount, hasSentenceEnd]);

  const enqueueTranscriptForTranslation = useCallback((text: string) => {
    const normalized = text.trim();
    if (!normalized || normalized === lastQueuedTranscriptRef.current) {
      return;
    }

    lastQueuedTranscriptRef.current = normalized;
    translationQueueRef.current.push(normalized);
    if (translationQueueRef.current.length > MAX_TRANSLATION_QUEUE) {
      translationQueueRef.current = translationQueueRef.current.slice(-MAX_TRANSLATION_QUEUE);
    }

    pumpTranslationQueue();
  }, [pumpTranslationQueue]);

  const flushPendingTranscriptBuffer = useCallback(() => {
    const pendingTranscript = pendingTranscriptBufferRef.current.trim();
    if (!pendingTranscript) {
      return;
    }

    pendingTranscriptBufferRef.current = '';
    enqueueTranscriptForTranslation(pendingTranscript);
  }, [enqueueTranscriptForTranslation]);

  const handleTranscript = useCallback((text: string) => {
    const normalized = text.trim();
    if (!normalized) {
      return;
    }

    if (ENABLE_SENTENCE_COMPLETENESS_BUFFER) {
      const buffered = pendingTranscriptBufferRef.current.trim();
      const combined = [buffered, normalized].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      if (!combined) {
        return;
      }

      if (!isCompleteSentence(combined)) {
        pendingTranscriptBufferRef.current = combined;
        return;
      }

      pendingTranscriptBufferRef.current = '';
      enqueueTranscriptForTranslation(combined);
      return;
    }

    const pendingTranscript = pendingTranscriptBufferRef.current.trim();
    if (pendingTranscript) {
      pendingTranscriptBufferRef.current = '';
      enqueueTranscriptForTranslation(`${pendingTranscript} ${normalized}`.replace(/\s+/g, ' ').trim());
      return;
    }

    if (getWordCount(normalized) < MIN_TRANSCRIPT_BUFFER_WORDS) {
      pendingTranscriptBufferRef.current = normalized;
      return;
    }

    enqueueTranscriptForTranslation(normalized);
  }, [enqueueTranscriptForTranslation, getWordCount, isCompleteSentence]);

  const handlePanelLanguageChange = useCallback((panelId: string, language: string) => {
    setPanelTargets(prev => ({ ...prev, [panelId]: language }));
    setPanelTranslations(prev => ({ ...prev, [panelId]: '' }));
  }, []);

  const handlePanelCountChange = useCallback((newCount: number) => {
    const clamped = Math.max(1, Math.min(4, newCount));
    setPanelCount(clamped);

    const newTargets: Record<string, string> = {};
    const newTranslations: Record<string, string> = {};
    const defaultLanguages = ['Hindi', 'English', 'Kannada', 'Tamil'];

    for (let i = 1; i <= clamped; i++) {
      const panelId = `panel-${i}`;
      newTargets[panelId] = panelTargets[panelId] || defaultLanguages[i - 1] || 'English';
      newTranslations[panelId] = panelTranslations[panelId] || '';
    }

    setPanelTargets(newTargets);
    setPanelTranslations(newTranslations);
  }, [panelTargets, panelTranslations]);

  useEffect(() => {
    panelTargetsRef.current = panelTargets;
  }, [panelTargets]);

  useEffect(() => {
    isStreamAudioEnabledRef.current = isStreamAudioEnabled;
  }, [isStreamAudioEnabled]);

  useEffect(() => {
    if (!isListening) {
      flushPendingTranscriptBuffer();
    }
  }, [flushPendingTranscriptBuffer, isListening]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STREAM_AUDIO_SETTINGS_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as {
        isStreamAudioEnabled?: boolean;
        streamAudioLanguage?: string;
      };

      if (typeof parsed.isStreamAudioEnabled === 'boolean') {
        setIsStreamAudioEnabled(parsed.isStreamAudioEnabled);
        isStreamAudioEnabledRef.current = parsed.isStreamAudioEnabled;
      }

      if (
        typeof parsed.streamAudioLanguage === 'string' &&
        STREAMABLE_LANGUAGES.includes(parsed.streamAudioLanguage as typeof STREAMABLE_LANGUAGES[number])
      ) {
        setStreamAudioLanguage(parsed.streamAudioLanguage);
      }
    } catch (error) {
      console.warn('Failed to load stream audio settings:', error);
    }
  }, []);

  const getStreamAudioSentences = useCallback((language: string, translations: Record<string, string>, targets: Record<string, string>) => {
    const panelId = Object.keys(targets).find((key) => targets[key] === language);
    if (!panelId) {
      return { lineCount: 0, sentences: [] as string[] };
    }

    const lines = translations[panelId]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const splitSentences = (text: string) => {
      const parts = text.match(/[^.!?।]+[.!?।]?/g);
      return (parts && parts.length > 0 ? parts : [text]).map((part) => part.trim()).filter(Boolean);
    };

    const sentences = lines.flatMap((line) => splitSentences(line));

    return {
      lineCount: lines.length,
      sentences,
    };
  }, []);

  const handleStartListening = useCallback(() => {
    if (!vadReady || vadError) return;

    if (isListening) {
      flushPendingTranscriptBuffer();
      setIsListening(false);
      setIsSpeaking(false);
    } else {
      setIsListening(true);
    }
  }, [flushPendingTranscriptBuffer, isListening, vadError, vadReady]);

  const isLoading = !vadReady && !vadError;

  const playSentenceAudio = useCallback(async (sentence: string, targetLanguage: string) => {
    const { audioBlob, metrics } = await TtsService.synthesize(sentence, targetLanguage);
    if (metrics) setLastTtsMetrics(metrics);

    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }

    if (activeAudioUrlRef.current) {
      URL.revokeObjectURL(activeAudioUrlRef.current);
      activeAudioUrlRef.current = null;
    }

    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    activeAudioRef.current = audio;
    activeAudioUrlRef.current = audioUrl;

    const cleanup = () => {
      if (activeAudioRef.current === audio) {
        activeAudioRef.current = null;
      }
      if (activeAudioUrlRef.current === audioUrl) {
        URL.revokeObjectURL(audioUrl);
        activeAudioUrlRef.current = null;
      }
    };

    audio.onended = cleanup;
    audio.onerror = cleanup;

    await audio.play();
  }, []);

  const stopStreamAudioPlayback = useCallback(() => {
    streamAudioQueueRef.current = [];
    audioPlaybackQueueRef.current = [];
    setStreamAudioQueueSize(0);
    setAudioPlaybackQueueSize(0);
    setIsStreamingAudioActive(false);
    isAudioPlaybackRunningRef.current = false;

    if (activeStreamAudioRef.current) {
      activeStreamAudioRef.current.pause();
      activeStreamAudioRef.current.currentTime = 0;
      activeStreamAudioRef.current = null;
    }

    if (activeStreamAudioUrlRef.current) {
      URL.revokeObjectURL(activeStreamAudioUrlRef.current);
      activeStreamAudioUrlRef.current = null;
    }
  }, []);

  const pumpAudioPlaybackQueue = useCallback(() => {
    if (isAudioPlaybackRunningRef.current) {
      return;
    }

    if (audioPlaybackQueueRef.current.length === 0) {
      setIsStreamingAudioActive(false);
      return;
    }

    isAudioPlaybackRunningRef.current = true;
    setIsStreamingAudioActive(true);

    const nextPlaybackItem = audioPlaybackQueueRef.current.shift();
    setAudioPlaybackQueueSize(audioPlaybackQueueRef.current.length);

    if (!nextPlaybackItem) {
      isAudioPlaybackRunningRef.current = false;
      pumpAudioPlaybackQueue();
      return;
    }

    if (activeStreamAudioRef.current) {
      activeStreamAudioRef.current.pause();
      activeStreamAudioRef.current.currentTime = 0;
      activeStreamAudioRef.current = null;
    }

    if (activeStreamAudioUrlRef.current) {
      URL.revokeObjectURL(activeStreamAudioUrlRef.current);
      activeStreamAudioUrlRef.current = null;
    }

    const audioUrl = URL.createObjectURL(nextPlaybackItem.audioBlob);
    const audio = new Audio(audioUrl);
    activeStreamAudioRef.current = audio;
    activeStreamAudioUrlRef.current = audioUrl;

    const cleanup = () => {
      audio.onended = null;
      audio.onerror = null;
      if (activeStreamAudioRef.current === audio) {
        activeStreamAudioRef.current = null;
      }
      if (activeStreamAudioUrlRef.current === audioUrl) {
        URL.revokeObjectURL(audioUrl);
        activeStreamAudioUrlRef.current = null;
      }
    };

    audio.onended = () => {
      cleanup();
      isAudioPlaybackRunningRef.current = false;
      pumpAudioPlaybackQueue();
    };

    audio.onerror = () => {
      console.warn('Stream audio playback error');
      cleanup();
      isAudioPlaybackRunningRef.current = false;
      pumpAudioPlaybackQueue();
    };

    audio.play().catch((error) => {
      console.warn('Stream audio play failed:', error);
      cleanup();
      isAudioPlaybackRunningRef.current = false;
      pumpAudioPlaybackQueue();
    });
  }, []);

  const pumpStreamAudioQueue = useCallback(async () => {
    if (isStreamQueueRunningRef.current) {
      return;
    }

    isStreamQueueRunningRef.current = true;

    while (streamAudioQueueRef.current.length > 0) {
      const nextItem = streamAudioQueueRef.current.shift();
      setStreamAudioQueueSize(streamAudioQueueRef.current.length);

      if (!nextItem) {
        continue;
      }

      if (!nextItem.forcePlayback && !isStreamAudioEnabledRef.current) {
        continue;
      }

      try {
        const { audioBlob, metrics } = await TtsService.synthesize(nextItem.text, nextItem.language);
        if (metrics) {
          setLastTtsMetrics(metrics);
        }

        if (!nextItem.forcePlayback && !isStreamAudioEnabledRef.current) {
          break;
        }

        audioPlaybackQueueRef.current.push({ audioBlob, metrics });
        if (audioPlaybackQueueRef.current.length > MAX_AUDIO_PLAYBACK_QUEUE) {
          audioPlaybackQueueRef.current = audioPlaybackQueueRef.current.slice(-MAX_AUDIO_PLAYBACK_QUEUE);
        }
        setAudioPlaybackQueueSize(audioPlaybackQueueRef.current.length);

        pumpAudioPlaybackQueue();
      } catch (error) {
        console.warn('Stream audio generation failed:', error);
      }
    }

    isStreamQueueRunningRef.current = false;
  }, [pumpAudioPlaybackQueue]);

  const enqueueStreamAudio = useCallback((sentences: string[], language: string) => {
    if (!isStreamAudioEnabledRef.current || !STREAMABLE_LANGUAGES.includes(language as typeof STREAMABLE_LANGUAGES[number])) {
      return;
    }

    const nextItems = sentences
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .map((text) => ({ text, language, forcePlayback: false }));

    if (nextItems.length === 0) {
      return;
    }

    streamAudioQueueRef.current.push(...nextItems);
    if (streamAudioQueueRef.current.length > MAX_STREAM_AUDIO_QUEUE) {
      streamAudioQueueRef.current = streamAudioQueueRef.current.slice(-MAX_STREAM_AUDIO_QUEUE);
    }
    setStreamAudioQueueSize(streamAudioQueueRef.current.length);
    void pumpStreamAudioQueue();
  }, [pumpStreamAudioQueue]);

  const enqueueSummaryAudio = useCallback((sentences: string[], language: string) => {
    if (!STREAMABLE_LANGUAGES.includes(language as typeof STREAMABLE_LANGUAGES[number])) {
      return;
    }

    const nextItems = sentences
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .map((text) => ({ text, language, forcePlayback: true }));

    if (nextItems.length === 0) {
      return;
    }

    streamAudioQueueRef.current.push(...nextItems);
    if (streamAudioQueueRef.current.length > MAX_STREAM_AUDIO_QUEUE) {
      streamAudioQueueRef.current = streamAudioQueueRef.current.slice(-MAX_STREAM_AUDIO_QUEUE);
    }
    setStreamAudioQueueSize(streamAudioQueueRef.current.length);
    void pumpStreamAudioQueue();
  }, [pumpStreamAudioQueue]);

  const queueCurrentStreamAudio = useCallback((language: string, translations: Record<string, string>, targets: Record<string, string>) => {
    const { lineCount, sentences } = getStreamAudioSentences(language, translations, targets);
    processedStreamLineCountsRef.current[language] = lineCount;
    enqueueStreamAudio(sentences, language);
  }, [enqueueStreamAudio, getStreamAudioSentences]);

  const handleStreamAudioEnabledChange = useCallback((enabled: boolean) => {
    setIsStreamAudioEnabled(enabled);
    isStreamAudioEnabledRef.current = enabled;
    setHasUnsavedStreamAudioSettings(true);
    setStreamAudioSettingsMessage('');
    if (!enabled) {
      stopStreamAudioPlayback();
      return;
    }

    queueCurrentStreamAudio(streamAudioLanguage, panelTranslations, panelTargets);
  }, [panelTargets, panelTranslations, queueCurrentStreamAudio, stopStreamAudioPlayback, streamAudioLanguage]);

  const handleStreamAudioLanguageChange = useCallback((language: string) => {
    setStreamAudioLanguage(language);
    setHasUnsavedStreamAudioSettings(true);
    setStreamAudioSettingsMessage('');
    stopStreamAudioPlayback();
    if (isStreamAudioEnabledRef.current) {
      queueCurrentStreamAudio(language, panelTranslations, panelTargets);
      return;
    }

    const { lineCount } = getStreamAudioSentences(language, panelTranslations, panelTargets);
    processedStreamLineCountsRef.current[language] = lineCount;
  }, [getStreamAudioSentences, panelTargets, panelTranslations, queueCurrentStreamAudio, stopStreamAudioPlayback]);

  const handleSaveStreamAudioSettings = useCallback(() => {
    try {
      window.localStorage.setItem(
        STREAM_AUDIO_SETTINGS_KEY,
        JSON.stringify({
          isStreamAudioEnabled,
          streamAudioLanguage,
        })
      );
      setHasUnsavedStreamAudioSettings(false);
      setStreamAudioSettingsMessage('Settings saved');
    } catch (error) {
      console.warn('Failed to save stream audio settings:', error);
      setStreamAudioSettingsMessage('Save failed');
    }
  }, [isStreamAudioEnabled, streamAudioLanguage]);

  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      if (activeAudioUrlRef.current) {
        URL.revokeObjectURL(activeAudioUrlRef.current);
        activeAudioUrlRef.current = null;
      }

      if (activeStreamAudioRef.current) {
        activeStreamAudioRef.current.pause();
        activeStreamAudioRef.current = null;
      }

      if (activeStreamAudioUrlRef.current) {
        URL.revokeObjectURL(activeStreamAudioUrlRef.current);
        activeStreamAudioUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isStreamAudioEnabled) {
      return;
    }

    const panelId = Object.keys(panelTargets).find((key) => panelTargets[key] === streamAudioLanguage);
    if (!panelId) {
      return;
    }

    const lines = panelTranslations[panelId]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const currentCount = lines.length;
    const previousCount = processedStreamLineCountsRef.current[streamAudioLanguage] ?? 0;

    if (currentCount < previousCount) {
      processedStreamLineCountsRef.current[streamAudioLanguage] = currentCount;
      return;
    }

    if (currentCount === previousCount) {
      return;
    }

    processedStreamLineCountsRef.current[streamAudioLanguage] = currentCount;

    const pendingLines = lines.slice(previousCount);
    if (pendingLines.length === 0) {
      return;
    }

    const pendingSentences = pendingLines.flatMap((line) => {
      const parts = line.match(/[^.!?।]+[.!?।]?/g);
      return (parts && parts.length > 0 ? parts : [line]).map((part) => part.trim()).filter(Boolean);
    });

    if (pendingSentences.length === 0) {
      return;
    }

    enqueueStreamAudio(pendingSentences, streamAudioLanguage);
  }, [enqueueStreamAudio, getStreamAudioSentences, isStreamAudioEnabled, panelTargets, panelTranslations, streamAudioLanguage]);

  useEffect(() => {
    if (availableStreamAudioLanguages.length === 0) {
      setIsStreamAudioEnabled(false);
      isStreamAudioEnabledRef.current = false;
      stopStreamAudioPlayback();
      return;
    }

    if (!availableStreamAudioLanguages.includes(streamAudioLanguage)) {
      setStreamAudioLanguage(availableStreamAudioLanguages[0]);
    }
  }, [availableStreamAudioLanguages, streamAudioLanguage, stopStreamAudioPlayback]);

  useEffect(() => {
    return () => {
      pendingTranscriptBufferRef.current = '';
      translationQueueRef.current = [];
      audioPlaybackQueueRef.current = [];
    };
  }, []);

  const splitTextToSentences = useCallback((text: string) => {
    const parts = text.match(/[^.!?।]+[.!?।]?/g);
    return (parts && parts.length > 0 ? parts : [text]).map((part) => part.trim()).filter(Boolean);
  }, []);

  const hasAnyPanelContent = Object.values(panelTranslations).some((text) => text.trim().length > 0);
  const canGenerateSummary = !isLoading && !vadError && !isListening && hasAnyPanelContent;

  const handleGenerateSummary = useCallback(() => {
    if (!canGenerateSummary) {
      return;
    }

    const summarySentences = splitTextToSentences(PREDEFINED_SUMMARY_TEXT);
    if (summarySentences.length === 0) {
      return;
    }

    enqueueSummaryAudio(summarySentences, streamAudioLanguage);
  }, [canGenerateSummary, enqueueSummaryAudio, splitTextToSentences, streamAudioLanguage]);

  return (
    <div className={styles.container}>
      <Sidebar
        onDeviceSelect={() => {}}
        panelCount={panelCount}
        onPanelCountChange={handlePanelCountChange}
        isStreamAudioEnabled={isStreamAudioEnabled}
        streamAudioLanguage={streamAudioLanguage}
        availableStreamAudioLanguages={availableStreamAudioLanguages}
        streamAudioQueueSize={streamAudioQueueSize}
        audioPlaybackQueueSize={audioPlaybackQueueSize}
        isStreamingAudioActive={isStreamingAudioActive}
        onStreamAudioEnabledChange={handleStreamAudioEnabledChange}
        onStreamAudioLanguageChange={handleStreamAudioLanguageChange}
        onSaveSettings={handleSaveStreamAudioSettings}
        hasUnsavedSettings={hasUnsavedStreamAudioSettings}
        settingsMessage={streamAudioSettingsMessage}
      />

      <main className={styles.mainContent}>
        <header className={styles.header} style={{ justifyContent: 'flex-start', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src="/intel-logo.png"
              alt="Intel Logo"
              style={{
                height: '40px',
                filter: 'brightness(1.2) drop-shadow(0 2px 8px rgba(0, 199, 253, 0.3))',
                transition: 'all 0.3s ease'
              }}
            />
          </div>

          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '4px',
            }}
          >
            <h1 style={{ margin: 0 }}>
              Intel® Core™ Ultra Series 3
            </h1>

            <h2 style={{ margin: 0 }}>
              Real-time English Voice to Indic Text
            </h2>
          </div>

          <div style={{ position: 'absolute', right: '16px', top: '0px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div
              style={{
                position: 'relative',
                width: '120px',
                height: '80px',
                borderRadius: '0px',
                overflow: 'hidden',
                opacity: 0.7,
              }}
            >
              <img
                src="/cat_eyes.jpg"
                alt="Cat"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: 0.9,
                  filter: 'brightness(1.2) saturate(0.85) blur(0.2px)',
                }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.08), rgba(15, 23, 42, 0.15))',
                  pointerEvents: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              {vadError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                  <AlertCircle size={18} /> VAD failed to load
                </div>
              )}
            </div>

          </div>
        </header>

        <div className={styles.translationGrid} style={{ gridTemplateColumns: `repeat(${panelCount}, minmax(0, 1fr))` }}>
          {Array.from({ length: panelCount }, (_, i) => {
            const panelId = `panel-${i + 1}`;
            const variantMap: Record<number, 'Color1' | 'Color2' | 'Color3' | 'Color1'> = { 0: 'Color1', 1: 'Color2', 2: 'Color3', 3: 'Color1' };
            return (
              <TranslationPanel
                key={panelId}
                id={panelId}
                targetLang={panelTargets[panelId] || 'English'}
                translatedText={panelTranslations[panelId] || ''}
                isTranslating={isTranslating}
                onTargetLangChange={handlePanelLanguageChange}
                onSpeakSentence={playSentenceAudio}
                variant={variantMap[i]}
              />
            );
          })}
        </div>

        {!vadError && (
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                className={styles.button}
                style={{
                  background: isListening ? 'rgba(239, 68, 68, 0.25)' : 'var(--primary)',
                  border: isListening ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid transparent',
                  color: isListening ? '#fecaca' : 'white',
                  padding: '12px 24px',
                  borderRadius: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isLoading ? 0.7 : 1,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}
                onClick={handleStartListening}
                disabled={isLoading}
              >
                {isLoading ? (
                  <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading VAD...</>
                ) : isListening ? (
                  <><MicOff size={18} /> Stop Listening</>
                ) : (
                  <><Activity size={18} /> Start Listening</>
                )}
              </button>

              {isListening && !isLoading && isSpeaking && (
                <div className={styles.liveIndicator}>
                  <div className={styles.liveDot} />
                  Capturing Speech...
                </div>
              )}
              {isListening && !isLoading && !isSpeaking && (
                <div className={styles.liveIndicator} style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
                  <div className={styles.liveDot} style={{ background: 'var(--warning)', animation: 'none' }} />
                  Listening...
                </div>
              )}
            </div>

            <button
              className={styles.button}
              style={{
                background: 'rgba(16, 185, 129, 0.18)',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                padding: '12px 20px',
                borderRadius: '30px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#d1fae5',
              }}
              onClick={handleGenerateSummary}
              disabled={!canGenerateSummary}
              title="Queues predefined summary sentences for TTS playback"
            >
              <FileText size={18} /> Generate Summary
            </button>
          </div>
        )}

        <div className={styles.disclaimerText}>
          This is an AI generated content and may not be fully accurate.
        </div>
      </main>

      <VADController
        isListening={isListening}
        onTranscript={handleTranscript}
        onLog={addLog}
        onSpeakingChange={setIsSpeaking}
        onAsrMetrics={setLastAsrMetrics}
      />
    </div>
  );
}

export default App;
