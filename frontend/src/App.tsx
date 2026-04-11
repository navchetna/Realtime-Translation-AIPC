import { useState, useCallback } from 'react';
import styles from './App.module.css';
import { Sidebar } from './components/Sidebar';
import { TranslationPanel } from './components/TranslationPanel';
import { VADController } from './components/VADController';
import { Activity, MicOff, Loader2, AlertCircle } from 'lucide-react';

function App() {
  // VAD is only mounted when this is true
  const [vadMounted, setVadMounted] = useState(false);
  const [vadReady, setVadReady] = useState(false);
  const [vadError, setVadError] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [latestTranscript, setLatestTranscript] = useState('');
  const [asrHistory, setAsrHistory] = useState<string[]>([]);
  const [systemLog, setSystemLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    if (msg.startsWith('✓')) setVadReady(true);
    if (msg.startsWith('✗')) setVadError(true);
    setSystemLog(prev => [...prev, msg]);
  }, []);

  const handleTranscript = useCallback((text: string) => {
    setLatestTranscript(text);
    setAsrHistory(prev => [...prev, text]);
  }, []);

  const handleStartListening = () => {
    if (!vadMounted) {
      // Mount VADController for the first time — triggers model load
      setVadMounted(true);
      addLog('⏳ Loading Silero VAD model...');
      setIsListening(true);
    } else if (isListening) {
      // Can't pause from here since VAD controls itself — just unmount
      setVadMounted(false);
      setIsListening(false);
      setIsSpeaking(false);
      setVadReady(false);
    } else {
      setVadMounted(true);
      setIsListening(true);
    }
  };

  const isLoading = vadMounted && !vadReady && !vadError;

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
                }}
                onClick={handleStartListening}
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

        <div className={styles.asrPanel} style={{ marginBottom: '24px', marginTop: 0 }}>
          <div className={styles.asrTitle}>ASR Live Transcript</div>
          <div className={styles.asrContent}>
            {systemLog.map((msg, i) => (
              <div key={`sys-${i}`} style={{
                marginBottom: '6px',
                color: msg.startsWith('✓') ? 'var(--success)' : msg.startsWith('✗') ? 'var(--danger)' : 'var(--text-muted)',
                fontSize: '0.85rem',
                fontStyle: 'italic'
              }}>
                {msg}
              </div>
            ))}
            {asrHistory.map((text, i) => (
              <div key={`t-${i}`} style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--accent)' }}>System: </span>{text}
              </div>
            ))}
            {isSpeaking && (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Detecting speech...</div>
            )}
          </div>
        </div>

        <div className={styles.translationGrid}>
          <TranslationPanel id="panel-1" defaultLang="Hindi" sourceText={latestTranscript} variant="Color1" />
          <TranslationPanel id="panel-2" defaultLang="Tamil" sourceText={latestTranscript} variant="Color2" />
          <TranslationPanel id="panel-3" defaultLang="Bengali" sourceText={latestTranscript} variant="Color3" />
        </div>
      </main>

      {/* VADController is mounted ONLY after user clicks Start — keeps initial render clean */}
      {vadMounted && (
        <VADController
          onTranscript={handleTranscript}
          onLog={addLog}
          onSpeakingChange={setIsSpeaking}
        />
      )}
    </div>
  );
}

export default App;
