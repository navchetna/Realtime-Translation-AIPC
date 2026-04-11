import { useState, useCallback, useEffect, useRef } from 'react';
import styles from './App.module.css';
import { Sidebar } from './components/Sidebar';
import { TranslationPanel } from './components/TranslationPanel';
import { VADController } from './components/VADController';
import { Activity, MicOff, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { TranslationService } from './services/TranslationService';

function App() {
  const [vadReady, setVadReady] = useState(false);
  const [vadError, setVadError] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [latestTranscript, setLatestTranscript] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isAudioPanelCollapsed, setIsAudioPanelCollapsed] = useState(false);
  const [panelTargets, setPanelTargets] = useState<Record<string, string>>({
    'panel-1': 'Hindi',
    'panel-2': 'Tamil',
    'panel-3': 'Bengali',
  });
  const [panelTranslations, setPanelTranslations] = useState<Record<string, string>>({
    'panel-1': '',
    'panel-2': '',
    'panel-3': '',
  });
  const lastProcessedRequestKeyRef = useRef('');

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

  const handleTranscript = useCallback((text: string) => {
    setLatestTranscript(text);
  }, []);

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

  useEffect(() => {
    if (!latestTranscript.trim()) {
      return;
    }

    const requestKey = `${latestTranscript}::${Object.values(panelTargets).join('|')}`;
    if (requestKey === lastProcessedRequestKeyRef.current) {
      return;
    }

    lastProcessedRequestKeyRef.current = requestKey;

    let cancelled = false;

    const appendChunk = (existing: string, nextChunk: string) => {
      if (!nextChunk.trim()) return existing;
      return existing ? `${existing}\n${nextChunk}` : nextChunk;
    };

    const runBatchTranslation = async () => {
      setIsTranslating(true);
      const currentTargets = { ...panelTargets };
      
      console.log('[App] Starting batch translation for transcript:', latestTranscript);
      console.log('[App] Current targets:', currentTargets);
      console.log('[App] Target language names:', Object.values(currentTargets));

      const languageResults = await TranslationService.translateBatch(
        latestTranscript,
        Object.values(currentTargets),
        'hi'
      );

      console.log('[App] Received languageResults:', languageResults);
      console.log('[App] panelTargets:', currentTargets);
      console.log('[App] Will set translations:');
      console.log('[App]   panel-1: languageResults[' + currentTargets['panel-1'] + '] = ' + languageResults[currentTargets['panel-1']]);
      console.log('[App]   panel-2: languageResults[' + currentTargets['panel-2'] + '] = ' + languageResults[currentTargets['panel-2']]);
      console.log('[App]   panel-3: languageResults[' + currentTargets['panel-3'] + '] = ' + languageResults[currentTargets['panel-3']]);

      if (cancelled) return;

      setPanelTranslations(prev => {
        const newState = {
          'panel-1': appendChunk(prev['panel-1'], languageResults[currentTargets['panel-1']] || ''),
          'panel-2': appendChunk(prev['panel-2'], languageResults[currentTargets['panel-2']] || ''),
          'panel-3': appendChunk(prev['panel-3'], languageResults[currentTargets['panel-3']] || ''),
        };
        console.log('[App] New panelTranslations state:', newState);
        return newState;
      });
      setIsTranslating(false);
    };

    void runBatchTranslation();

    return () => {
      cancelled = true;
      setIsTranslating(false);
    };
  }, [latestTranscript, panelTargets]);

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
        </header>

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
        onTranscript={handleTranscript}
        onLog={addLog}
        onSpeakingChange={setIsSpeaking}
      />
    </div>
  );
}

export default App;
