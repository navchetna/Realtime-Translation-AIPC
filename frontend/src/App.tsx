import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import styles from './App.module.css';
import { Sidebar } from './components/Sidebar';
import { TranslationPanel } from './components/TranslationPanel';
import { VADController } from './components/VADController';
import { Activity, MicOff, Loader2, AlertCircle, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { TranslationService } from './services/TranslationService';
import type { NmtMetrics } from './services/TranslationService';
import type { AsrMetrics } from './services/AsrService';

function App() {
  const [vadReady, setVadReady] = useState(false);
  const [vadError, setVadError] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [sourceLang, setSourceLang] = useState<'hi' | 'en'>('hi');
  // ASR always runs in 'hi' mode — IndicConformer doesn't support English.
  // English speech gets phonetically transcribed into Devanagari.
  const asrLang = 'hi';
  const [latestTranscript, setLatestTranscript] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isAudioPanelCollapsed, setIsAudioPanelCollapsed] = useState(false);
  const [panelTargets, setPanelTargets] = useState<Record<string, string>>({
    'panel-1': 'Tamil',
    'panel-2': 'Punjabi',
    'panel-3': 'Malayalam',
  });
  const [panelTranslations, setPanelTranslations] = useState<Record<string, string>>({
    'panel-1': '',
    'panel-2': '',
    'panel-3': '',
  });
  const MAX_TRANSLATION_LINES = 40;
  const panelTargetsRef = useRef(panelTargets);
  useEffect(() => { panelTargetsRef.current = panelTargets; }, [panelTargets]);
  const translationQueueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const asrBodyRef = useRef<HTMLDivElement>(null);

  const transcriptLines = useMemo(
    () => latestTranscript.split('\n').filter(l => l.trim()),
    [latestTranscript]
  );

  useEffect(() => {
    if (asrBodyRef.current) asrBodyRef.current.scrollTop = asrBodyRef.current.scrollHeight;
  }, [latestTranscript]);

  const [showMetrics, setShowMetrics] = useState(false);
  const [lastAsrMetrics, setLastAsrMetrics] = useState<AsrMetrics | null>(null);
  const [lastNmtMetrics, setLastNmtMetrics] = useState<NmtMetrics | null>(null);

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

  const processTranslationQueue = useCallback(async () => {
    if (processingRef.current) return;
    if (translationQueueRef.current.length === 0) return;

    processingRef.current = true;
    setIsTranslating(true);

    while (translationQueueRef.current.length > 0) {
      const pending = translationQueueRef.current.splice(0);
      const batchText = pending.join(' ');
      const currentTargets = { ...panelTargetsRef.current };
      const nmtUrl = 'http://localhost:8004/services/inference/pipeline';

      try {
        const { results: languageResults, metrics: nmtMetrics } = await TranslationService.translateBatch(
          batchText,
          Object.values(currentTargets),
          'hi',
          nmtUrl
        );

        if (nmtMetrics) setLastNmtMetrics(nmtMetrics);

        setPanelTranslations(prev => ({
          'panel-1': appendChunk(prev['panel-1'], languageResults[currentTargets['panel-1']] || ''),
          'panel-2': appendChunk(prev['panel-2'], languageResults[currentTargets['panel-2']] || ''),
          'panel-3': appendChunk(prev['panel-3'], languageResults[currentTargets['panel-3']] || ''),
        }));
      } catch (err) {
        console.warn('Translation failed:', err);
      }
    }

    processingRef.current = false;
    setIsTranslating(false);
  }, [appendChunk]);

  const handleTranscript = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLatestTranscript(prev => {
      const combined = prev ? `${prev}\n${trimmed}` : trimmed;
      const lines = combined.split('\n').filter(l => l.trim());
      return lines.slice(-MAX_TRANSLATION_LINES).join('\n');
    });
    translationQueueRef.current.push(trimmed);
    void processTranslationQueue();
  }, [processTranslationQueue]);

  const handlePanelLanguageChange = useCallback((panelId: string, language: string) => {
    setPanelTargets(prev => ({ ...prev, [panelId]: language }));
    setPanelTranslations(prev => ({ ...prev, [panelId]: '' }));
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

  return (
    <div className={styles.container}>
      <Sidebar onDeviceSelect={() => {}} />

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
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', opacity: 0.7 }}>Speaking:</span>
              <button
                className={styles.button}
                style={{
                  padding: '6px 14px', borderRadius: '20px', fontSize: '13px',
                  background: sourceLang === 'hi' ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                }}
                onClick={() => setSourceLang('hi')}
              >Hindi</button>
              <button
                className={styles.button}
                style={{
                  padding: '6px 14px', borderRadius: '20px', fontSize: '13px',
                  background: sourceLang === 'en' ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                }}
                onClick={() => setSourceLang('en')}
              >English</button>
            </div>
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
            {lastAsrMetrics && lastNmtMetrics && (
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
            {!lastAsrMetrics && !lastNmtMetrics && (
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
          <div className={styles.asrContent} ref={asrBodyRef}>
            <div style={{ color: isSpeaking ? 'var(--success)' : 'var(--text-muted)', fontStyle: 'italic', marginBottom: '12px' }}>
              {isSpeaking ? 'Audio detected' : 'No speech detected'}
            </div>
            {transcriptLines.length > 0 && (
              <div style={{
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
              }}>
                <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '6px' }}>🎤 Hindi</div>
                {transcriptLines.map((line, index) => {
                  const distFromEnd = transcriptLines.length - 1 - index;
                  const isLatest = distFromEnd === 0;
                  const opacity = isLatest ? 1 : distFromEnd === 1 ? 0.55 : distFromEnd === 2 ? 0.35 : 0.2;
                  return (
                    <div
                      key={index}
                      className={`${styles.lyricsLine}${isLatest ? ` ${styles.lyricsLineLatest}` : ''}`}
                      style={{ opacity }}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className={styles.translationGrid}>
          <TranslationPanel
            id="panel-1"
            targetLang={panelTargets['panel-1']}
            translatedText={panelTranslations['panel-1']}
            isTranslating={isTranslating}
            onTargetLangChange={handlePanelLanguageChange}
            variant="Color1"
          />
          <TranslationPanel
            id="panel-2"
            targetLang={panelTargets['panel-2']}
            translatedText={panelTranslations['panel-2']}
            isTranslating={isTranslating}
            onTargetLangChange={handlePanelLanguageChange}
            variant="Color2"
          />
          <TranslationPanel
            id="panel-3"
            targetLang={panelTargets['panel-3']}
            translatedText={panelTranslations['panel-3']}
            isTranslating={isTranslating}
            onTargetLangChange={handlePanelLanguageChange}
            variant="Color3"
          />
        </div>
      </main>

      <VADController
        isListening={isListening}
        sourceLang={asrLang}
        onTranscript={handleTranscript}
        onLog={addLog}
        onSpeakingChange={setIsSpeaking}
        onAsrMetrics={setLastAsrMetrics}
      />
    </div>
  );
}

export default App;
