/**
 * Main Application Component
 * Real-time Speech-to-Speech Translation with VAD
 */

import { useState, useEffect } from 'react';
import { VADController } from './components/VADController';
import { TranscriptionPanel } from './components/TranscriptionPanel';
import { MetricsDisplay } from './components/MetricsDisplay';
import { ConfigPanel } from './components/ConfigPanel';
import { asrService } from './services/AsrService';
import { ttsService } from './services/TtsService';
import { translationService } from './services/TranslationService';
import { MODEL_NAMES, DEFAULT_CONFIG } from './config/apiConfig';
import type {
  TranscriptionResult,
  TranslationResult,
  SessionMetrics,
} from './types';
import './App.css';

function App() {
  // Listening state
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Configuration (initialized from environment)
  const [inputLanguage, setInputLanguage] = useState(DEFAULT_CONFIG.inputLanguage);
  const [outputLanguage, setOutputLanguage] = useState(DEFAULT_CONFIG.outputLanguage);
  const [ttsVoice, setTtsVoice] = useState(DEFAULT_CONFIG.ttsVoice);
  const [ttsSpeed, setTtsSpeed] = useState(DEFAULT_CONFIG.ttsSpeed);

  // UI state
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Transcriptions
  const [englishTranscriptions, setEnglishTranscriptions] = useState<TranscriptionResult[]>([]);
  const [japaneseTranscriptions, setJapaneseTranscriptions] = useState<TranslationResult[]>([]);

  // Metrics
  const [metrics, setMetrics] = useState<SessionMetrics>({
    asrRTF: 0,
    llmTokensPerSec: 0,
    ttsRTF: 0,
    totalLatency: 0,
  });

  // Session stats
  const [sessionStats, setSessionStats] = useState({
    translationCount: 0,
    totalAudioTime: 0,
    avgRTF: 0,
  });

  // Service health
  const [servicesHealthy, setServicesHealthy] = useState(false);

  // Check service health on mount
  useEffect(() => {
    checkServicesHealth();
  }, []);

  const checkServicesHealth = async () => {
    try {
      const [asrHealthy, ttsHealthy, llmHealthy] = await Promise.all([
        asrService.checkHealth(),
        ttsService.checkHealth(),
        translationService.checkHealth(),
      ]);

      const allHealthy = asrHealthy && ttsHealthy && llmHealthy;
      setServicesHealthy(allHealthy);

      if (!allHealthy) {
        console.warn('Some services are not healthy:', {
          asrHealthy,
          ttsHealthy,
          llmHealthy,
        });
      }
    } catch (error) {
      console.error('Health check failed:', error);
      setServicesHealthy(false);
    }
  };

  // Handle new transcription from VAD
  const handleTranscript = async (result: TranscriptionResult) => {
    if (!result.text.trim()) {
      console.log('[App] Empty transcription, skipping');
      return;
    }

    console.log('[App] New transcription:', result.text);

    // Add English transcription
    setEnglishTranscriptions((prev) => [...prev, result]);

    // Update ASR metrics
    if (result.metrics) {
      setMetrics((prev) => ({
        ...prev,
        asrRTF: result.metrics!.rtf,
      }));
    }

    try {
      const pipelineStartTime = performance.now();

      // Translate text
      console.log('[App] Translating text...');
      const translationStartTime = performance.now();
      const translation = await translationService.translateText(
        result.text,
        inputLanguage,
        outputLanguage
      );
      const translationTime = (performance.now() - translationStartTime) / 1000;

      console.log('[App] Translation received:', translation.text.substring(0, 100));

      // Update LLM metrics
      setMetrics((prev) => ({
        ...prev,
        llmTokensPerSec: translation.metrics.tokensPerSec,
      }));

      // Create translation result (without audio initially)
      const translationResult: TranslationResult = {
        text: translation.text,
        timestamp: new Date(),
        audioBlob: undefined,
        metrics: translation.metrics,
      };

      // Add translation to UI immediately (even if TTS fails later)
      setJapaneseTranscriptions((prev) => [...prev, translationResult]);
      console.log('[App] Translation added to UI');

      // Try to generate speech (don't block translation display if this fails)
      try {
        console.log('[App] Generating speech...');
        const ttsStartTime = performance.now();
        const { blob: audioBlob, metrics: ttsMetrics } = await ttsService.synthesizeSpeech(
          translation.text,
          outputLanguage,
          ttsVoice,
          ttsSpeed
        );
        const ttsTime = (performance.now() - ttsStartTime) / 1000;

        // Calculate total pipeline latency (processing time only, not audio duration)
        // ASR inference time + Translation request time + TTS inference time
        const asrInferenceTime = result.metrics?.inference_time_s || 0;
        const totalLatency = asrInferenceTime + translationTime + ttsTime;

        // Update metrics
        setMetrics((prev) => ({
          ...prev,
          ttsRTF: ttsMetrics.rtf,
          totalLatency: totalLatency,
        }));

        // Update the translation with audio blob
        setJapaneseTranscriptions((prev) =>
          prev.map((item, idx) =>
            idx === prev.length - 1 ? { ...item, audioBlob } : item
          )
        );

        console.log('[App] Pipeline complete:', {
          asrInference: `${(asrInferenceTime * 1000).toFixed(0)}ms`,
          translation: `${(translationTime * 1000).toFixed(0)}ms`,
          ttsInference: `${(ttsTime * 1000).toFixed(0)}ms`,
          totalLatency: `${(totalLatency * 1000).toFixed(0)}ms`,
          note: 'End-to-end processing time (not including audio playback duration)',
        });
      } catch (ttsError) {
        console.error('[App] TTS failed (translation still shown):', ttsError);

        // Update latency even if TTS fails (ASR inference + Translation only)
        const asrInferenceTime = result.metrics?.inference_time_s || 0;
        const totalLatency = asrInferenceTime + translationTime;
        setMetrics((prev) => ({
          ...prev,
          totalLatency: totalLatency,
        }));

        console.log('[App] Partial pipeline (TTS failed):', {
          asrInference: `${(asrInferenceTime * 1000).toFixed(0)}ms`,
          translation: `${(translationTime * 1000).toFixed(0)}ms`,
          totalLatency: `${(totalLatency * 1000).toFixed(0)}ms`,
        });
      }

      // Update session stats
      setSessionStats((prev) => ({
        translationCount: prev.translationCount + 1,
        totalAudioTime: prev.totalAudioTime + (result.metrics?.audio_duration_s || 0),
        avgRTF: (prev.avgRTF * prev.translationCount + (result.metrics?.rtf || 0)) / (prev.translationCount + 1),
      }));

      console.log('[App] Translation pipeline complete');
    } catch (error) {
      console.error('[App] Translation pipeline error:', error);
      handleError(error as Error);
    }
  };

  const handleError = (error: Error) => {
    console.error('[App] Error:', error);
  };

  const handleLog = (msg: string) => {
    console.log('[VAD Log]', msg);
    if (msg.startsWith('✓')) {
      setServicesHealthy(true);
    }
    if (msg.startsWith('✗')) {
      setServicesHealthy(false);
      setIsListening(false);
      setIsSpeaking(false);
    }
  };

  // Handle TTS request when user clicks on Japanese translation
  const handleRequestTTS = async (text: string, index: number): Promise<Blob | undefined> => {
    try {
      console.log('[App] Generating TTS for clicked translation:', text.substring(0, 50));

      const { blob: audioBlob } = await ttsService.synthesizeSpeech(
        text,
        outputLanguage,
        ttsVoice,
        ttsSpeed
      );

      // Update the translation with the audio blob
      setJapaneseTranscriptions((prev) =>
        prev.map((item, idx) => (idx === index ? { ...item, audioBlob } : item))
      );

      console.log('[App] TTS generated and added to translation');
      return audioBlob;
    } catch (error) {
      console.error('[App] TTS generation failed:', error);
      return undefined;
    }
  };

  const toggleListening = () => {
    if (!servicesHealthy && !isListening) {
      alert('Services are not ready. Please check that ASR and TTS services are running.');
      return;
    }

    setIsListening(!isListening);
    if (isListening) {
      setIsSpeaking(false);
    }
  };

  const clearTranscriptions = (panel: 'english' | 'japanese' | 'both') => {
    if (panel === 'english' || panel === 'both') {
      setEnglishTranscriptions([]);
    }
    if (panel === 'japanese' || panel === 'both') {
      setJapaneseTranscriptions([]);
    }
    if (panel === 'both') {
      setSessionStats({
        translationCount: 0,
        totalAudioTime: 0,
        avgRTF: 0,
      });
    }
  };

  const getStatusMessage = (): string => {
    if (!servicesHealthy) return 'Services not available';
    if (!isListening) return 'Ready';
    if (isSpeaking) return 'Speaking detected';
    return 'Listening...';
  };

  const getStatusColor = (): string => {
    if (!servicesHealthy) return 'error';
    if (!isListening) return 'success';
    if (isSpeaking) return 'active';
    return 'warning';
  };

  return (
    <div className="app">
      {/* VAD Controller (always mounted, controlled via isListening prop) */}
      <VADController
        isListening={isListening}
        inputLanguage={inputLanguage}
        onTranscript={handleTranscript}
        onLog={handleLog}
        onSpeakingChange={setIsSpeaking}
      />

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1>English to Japanese Real-time Translation</h1>
          <button className="config-trigger-btn" onClick={() => setIsConfigOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6M1 12h6m6 0h6" />
              <path d="M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24" />
            </svg>
            Settings
          </button>
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className="main-layout">
        {/* Sidebar with Listen Button and Metrics */}
        <aside className="sidebar">
          <button
            className={`listen-btn ${isListening ? 'stop' : 'start'} ${isSpeaking ? 'detecting' : ''}`}
            onClick={toggleListening}
            disabled={!servicesHealthy && !isListening}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              {isListening ? (
                <>
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </>
              ) : (
                <>
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </>
              )}
            </svg>
            <span>{isListening ? (isSpeaking ? 'Detecting Audio...' : 'Listening...') : 'Start Listening'}</span>
          </button>

          <div className={`status-indicator status-${getStatusColor()}`}>
            <span className="status-dot"></span>
            <span className="status-text">{getStatusMessage()}</span>
          </div>

          {/* Compact Metrics */}
          <div className="sidebar-metrics">
            <h4>Performance</h4>
            <MetricsDisplay metrics={metrics} />
          </div>

          {/* Compact Models */}
          <div className="sidebar-models">
            <h4>Models</h4>
            <div className="model-list">
              <div className="model-item">
                <span className="model-icon">🎤</span>
                <div>
                  <div className="model-label">ASR</div>
                  <div className="model-name">{MODEL_NAMES.ASR}</div>
                </div>
              </div>
              <div className="model-item">
                <span className="model-icon">🤖</span>
                <div>
                  <div className="model-label">LLM</div>
                  <div className="model-name">{MODEL_NAMES.LLM}</div>
                </div>
              </div>
              <div className="model-item">
                <span className="model-icon">🔊</span>
                <div>
                  <div className="model-label">TTS</div>
                  <div className="model-name">{MODEL_NAMES.TTS}</div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="content-area">
          {/* Transcription Panels */}
          <div className="transcription-area">
            <TranscriptionPanel
              title="🇬🇧 English Input"
              transcriptions={englishTranscriptions}
              onClear={() => clearTranscriptions('english')}
            />
            <TranscriptionPanel
              title="🇯🇵 Japanese Output"
              transcriptions={japaneseTranscriptions}
              onClear={() => clearTranscriptions('japanese')}
              isJapanese
              onRequestTTS={handleRequestTTS}
            />
          </div>
        </div>
      </div>

      {/* Configuration Drawer */}
      <ConfigPanel
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        isListening={isListening}
        inputLanguage={inputLanguage}
        outputLanguage={outputLanguage}
        ttsVoice={ttsVoice}
        ttsSpeed={ttsSpeed}
        sessionStats={sessionStats}
        onInputLanguageChange={setInputLanguage}
        onOutputLanguageChange={setOutputLanguage}
        onTtsVoiceChange={setTtsVoice}
        onTtsSpeedChange={setTtsSpeed}
      />
    </div>
  );
}

export default App;
