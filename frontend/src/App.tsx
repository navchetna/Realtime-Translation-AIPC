import { useState, useCallback, useEffect, useRef } from 'react';
import styles from './App.module.css';
import { Sidebar } from './components/Sidebar';
import { TranslationPanel } from './components/TranslationPanel';
import { VADController } from './components/VADController';
import { Activity, MicOff, Loader2, AlertCircle, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
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
};

function App() {
  const [vadReady, setVadReady] = useState(false);
  const [vadError, setVadError] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [isTranslating, setIsTranslating] = useState(false);
  const [isAudioPanelCollapsed, setIsAudioPanelCollapsed] = useState(false);
  const [panelTargets, setPanelTargets] = useState<Record<string, string>>({
    'panel-1': 'English',
    'panel-2': 'Tamil',
    'panel-3': 'Punjabi',
  });
  const [panelTranslations, setPanelTranslations] = useState<Record<string, string>>({
    'panel-1': '',
    'panel-2': '',
    'panel-3': '',
  });
  const [isStreamAudioEnabled, setIsStreamAudioEnabled] = useState(false);
  const [streamAudioLanguage, setStreamAudioLanguage] = useState<string>('Tamil');
  const [streamAudioQueueSize, setStreamAudioQueueSize] = useState(0);
  const [isStreamingAudioActive, setIsStreamingAudioActive] = useState(false);
  const [hasUnsavedStreamAudioSettings, setHasUnsavedStreamAudioSettings] = useState(false);
  const [streamAudioSettingsMessage, setStreamAudioSettingsMessage] = useState('');
  const MAX_TRANSLATION_LINES = 40;
  const MAX_TRANSLATION_QUEUE = 8;
  const translationQueueRef = useRef<string[]>([]);
  const isTranslationQueueRunningRef = useRef(false);
  const lastQueuedTranscriptRef = useRef('');
  const panelTargetsRef = useRef(panelTargets);
  const isStreamAudioEnabledRef = useRef(isStreamAudioEnabled);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioUrlRef = useRef<string | null>(null);
  const activeStreamAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeStreamAudioUrlRef = useRef<string | null>(null);
  const streamAudioQueueRef = useRef<StreamAudioItem[]>([]);
  const isStreamQueueRunningRef = useRef(false);
  const processedStreamLineCountsRef = useRef<Record<string, number>>({});

  const [showMetrics, setShowMetrics] = useState(false);
  const [lastAsrMetrics, setLastAsrMetrics] = useState<AsrMetrics | null>(null);
  const [lastNmtMetrics, setLastNmtMetrics] = useState<NmtMetrics | null>(null);
  const [lastTtsMetrics, setLastTtsMetrics] = useState<TtsMetrics | null>(null);

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
          return {
            'panel-1': appendChunk(prev['panel-1'], languageResults[currentTargets['panel-1']] || ''),
            'panel-2': appendChunk(prev['panel-2'], languageResults[currentTargets['panel-2']] || ''),
            'panel-3': appendChunk(prev['panel-3'], languageResults[currentTargets['panel-3']] || ''),
          };
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

  const handleTranscript = useCallback((text: string) => {
    const normalized = text.trim();
    if (!normalized) {
      return;
    }

    if (normalized === lastQueuedTranscriptRef.current) {
      return;
    }
    lastQueuedTranscriptRef.current = normalized;

    translationQueueRef.current.push(normalized);
    if (translationQueueRef.current.length > MAX_TRANSLATION_QUEUE) {
      translationQueueRef.current = translationQueueRef.current.slice(-MAX_TRANSLATION_QUEUE);
    }

    pumpTranslationQueue();
  }, [pumpTranslationQueue]);

  const handlePanelLanguageChange = useCallback((panelId: string, language: string) => {
    setPanelTargets(prev => ({ ...prev, [panelId]: language }));
    setPanelTranslations(prev => ({ ...prev, [panelId]: '' }));
  }, []);

  useEffect(() => {
    panelTargetsRef.current = panelTargets;
  }, [panelTargets]);

  useEffect(() => {
    isStreamAudioEnabledRef.current = isStreamAudioEnabled;
  }, [isStreamAudioEnabled]);

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

    const sentences = lines.flatMap((line) => {
      const parts = line.match(/[^.!?।]+[.!?।]?/g);
      return (parts && parts.length > 0 ? parts : [line]).map((part) => part.trim()).filter(Boolean);
    });

    return {
      lineCount: lines.length,
      sentences,
    };
  }, []);

  const handleStartListening = () => {
    if (!vadReady || vadError) return;

    if (isListening) {
      setIsListening(false);
      setIsSpeaking(false);
    } else {
      setIsListening(true);
    }
  };

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
    setStreamAudioQueueSize(0);
    setIsStreamingAudioActive(false);

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

  const pumpStreamAudioQueue = useCallback(async () => {
    if (isStreamQueueRunningRef.current) {
      return;
    }

    isStreamQueueRunningRef.current = true;

    while (isStreamAudioEnabledRef.current && streamAudioQueueRef.current.length > 0) {
      const nextItem = streamAudioQueueRef.current.shift();
      setStreamAudioQueueSize(streamAudioQueueRef.current.length);

      if (!nextItem) {
        continue;
      }

      setIsStreamingAudioActive(true);

      try {
        const { audioBlob, metrics } = await TtsService.synthesize(nextItem.text, nextItem.language);
        if (metrics) {
          setLastTtsMetrics(metrics);
        }

        if (!isStreamAudioEnabledRef.current) {
          break;
        }

        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        activeStreamAudioRef.current = audio;
        activeStreamAudioUrlRef.current = audioUrl;

        await new Promise<void>((resolve, reject) => {
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
            resolve();
          };
          audio.onerror = () => {
            cleanup();
            reject(new Error('Stream audio playback failed'));
          };

          void audio.play().catch((error) => {
            cleanup();
            reject(error);
          });
        });
      } catch (error) {
        console.warn('Stream audio generation failed:', error);
      }
    }

    isStreamQueueRunningRef.current = false;
    setIsStreamingAudioActive(false);
  }, []);

  const enqueueStreamAudio = useCallback((sentences: string[], language: string) => {
    if (!isStreamAudioEnabledRef.current || !STREAMABLE_LANGUAGES.includes(language as typeof STREAMABLE_LANGUAGES[number])) {
      return;
    }

    const nextItems = sentences
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .map((text) => ({ text, language }));

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
      translationQueueRef.current = [];
    };
  }, []);

  return (
    <div className={styles.container}>
      <Sidebar
        onDeviceSelect={() => {}}
        isStreamAudioEnabled={isStreamAudioEnabled}
        streamAudioLanguage={streamAudioLanguage}
        availableStreamAudioLanguages={availableStreamAudioLanguages}
        streamAudioQueueSize={streamAudioQueueSize}
        isStreamingAudioActive={isStreamingAudioActive}
        onStreamAudioEnabledChange={handleStreamAudioEnabledChange}
        onStreamAudioLanguageChange={handleStreamAudioLanguageChange}
        onSaveSettings={handleSaveStreamAudioSettings}
        hasUnsavedSettings={hasUnsavedStreamAudioSettings}
        settingsMessage={streamAudioSettingsMessage}
      />

      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img
              src="/intel-logo.svg"
              alt="Intel Logo"
              style={{
                height: '52px',
                filter: 'brightness(1.2) drop-shadow(0 2px 10px rgba(0, 199, 253, 0.3))',
                transition: 'all 0.3s ease'
              }}
            />
            <h1>Real-time Multi-lingual Translation</h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              {vadError ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                  <AlertCircle size={18} /> VAD failed to load
                </div>
              ) : (
                <button
                  className={styles.button}
                  style={{
                    background: isListening ? 'var(--danger)' : 'var(--primary)',
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
              )}

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
              className={`${styles.metricsToggleBtn}${showMetrics ? ` ${styles.metricsToggleBtnActive}` : ''}`}
              onClick={() => setShowMetrics(p => !p)}
            >
              <BarChart2 size={13} />
              {showMetrics ? 'Hide Metrics' : 'Show Metrics'}
            </button>
          </div>
        </header>

        {showMetrics && (
          <div className={styles.metricsBar}>
            {lastAsrMetrics && (
              <div className={styles.metricsGroup}>
                <span className={styles.metricsGroupLabel}>ASR</span>
                <div className={styles.metricChip}>
                  <span className={styles.metricChipLabel}>Latency</span>
                  <span className={styles.metricChipValue}>{lastAsrMetrics.latency_ms} ms</span>
                </div>
                <div className={styles.metricChip}>
                  <span className={styles.metricChipLabel}>Audio</span>
                  <span className={styles.metricChipValue}>{lastAsrMetrics.audio_duration_s} s</span>
                </div>
                <div className={styles.metricChip}>
                  <span className={styles.metricChipLabel}>RTF</span>
                  <span className={styles.metricChipValue}>{lastAsrMetrics.rtf.toFixed(3)}</span>
                </div>
              </div>
            )}
            {lastAsrMetrics && (lastNmtMetrics || lastTtsMetrics) && (
              <div style={{ width: '1px', background: 'var(--glass-border)', alignSelf: 'stretch' }} />
            )}
            {lastNmtMetrics && (
              <div className={styles.metricsGroup}>
                <span className={styles.metricsGroupLabel}>NMT</span>
                <div className={styles.metricChip}>
                  <span className={styles.metricChipLabel}>Latency</span>
                  <span className={styles.metricChipValue}>{lastNmtMetrics.latency_ms} ms</span>
                </div>
                <div className={styles.metricChip}>
                  <span className={styles.metricChipLabel}>Tokens/s</span>
                  <span className={styles.metricChipValue}>{lastNmtMetrics.tokens_per_sec.toFixed(1)}</span>
                </div>
                <div className={styles.metricChip}>
                  <span className={styles.metricChipLabel}>~Tokens</span>
                  <span className={styles.metricChipValue}>{lastNmtMetrics.approx_tokens}</span>
                </div>
              </div>
            )}
            {lastNmtMetrics && lastTtsMetrics && (
              <div style={{ width: '1px', background: 'var(--glass-border)', alignSelf: 'stretch' }} />
            )}
            {lastTtsMetrics && (
              <div className={styles.metricsGroup}>
                <span className={styles.metricsGroupLabel}>TTS</span>
                <div className={styles.metricChip}>
                  <span className={styles.metricChipLabel}>Latency</span>
                  <span className={styles.metricChipValue}>{lastTtsMetrics.latency_ms} ms</span>
                </div>
                <div className={styles.metricChip}>
                  <span className={styles.metricChipLabel}>Audio</span>
                  <span className={styles.metricChipValue}>{lastTtsMetrics.audio_duration_s} s</span>
                </div>
                <div className={styles.metricChip}>
                  <span className={styles.metricChipLabel}>RTF</span>
                  <span className={styles.metricChipValue}>{lastTtsMetrics.rtf.toFixed(3)}</span>
                </div>
              </div>
            )}
            {!lastAsrMetrics && !lastNmtMetrics && !lastTtsMetrics && (
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Speak a phrase to see metrics.</span>
            )}
          </div>
        )}

        <div className={`${styles.asrPanel} ${isAudioPanelCollapsed ? styles.asrPanelCollapsed : ''}`} style={{ marginBottom: '24px', marginTop: 0 }}>
          <div className={styles.asrHeader}>
            <div className={styles.asrTitle}>Audio Detection</div>
            <button
              className={styles.asrToggle}
              onClick={() => setIsAudioPanelCollapsed(prev => !prev)}
              aria-label={isAudioPanelCollapsed ? 'Expand audio status' : 'Collapse audio status'}
            >
              {isAudioPanelCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
          <div className={styles.asrContent}>
            <div style={{ color: isSpeaking ? 'var(--success)' : 'var(--text-muted)', fontStyle: 'italic' }}>
              {isSpeaking ? 'Audio detected' : 'No speech detected'}
            </div>
          </div>
        </div>

        <div className={styles.translationGrid}>
          <TranslationPanel
            id="panel-1"
            targetLang={panelTargets['panel-1']}
            translatedText={panelTranslations['panel-1']}
            isTranslating={isTranslating}
            onTargetLangChange={handlePanelLanguageChange}
            onSpeakSentence={playSentenceAudio}
            variant="Color1"
          />
          <TranslationPanel
            id="panel-2"
            targetLang={panelTargets['panel-2']}
            translatedText={panelTranslations['panel-2']}
            isTranslating={isTranslating}
            onTargetLangChange={handlePanelLanguageChange}
            onSpeakSentence={playSentenceAudio}
            variant="Color2"
          />
          <TranslationPanel
            id="panel-3"
            targetLang={panelTargets['panel-3']}
            translatedText={panelTranslations['panel-3']}
            isTranslating={isTranslating}
            onTargetLangChange={handlePanelLanguageChange}
            onSpeakSentence={playSentenceAudio}
            variant="Color3"
          />
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
