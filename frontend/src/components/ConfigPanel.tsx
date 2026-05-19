interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isListening: boolean;
  inputLanguage: string;
  outputLanguage: string;
  ttsVoice: string;
  ttsSpeed: number;
  sessionStats: {
    translationCount: number;
    totalAudioTime: number;
    avgRTF: number;
  };
  onInputLanguageChange: (lang: string) => void;
  onOutputLanguageChange: (lang: string) => void;
  onTtsVoiceChange: (voice: string) => void;
  onTtsSpeedChange: (speed: number) => void;
}

export function ConfigPanel({
  isOpen,
  onClose,
  isListening,
  inputLanguage,
  outputLanguage,
  ttsVoice,
  ttsSpeed,
  sessionStats,
  onInputLanguageChange,
  onOutputLanguageChange,
  onTtsVoiceChange,
  onTtsSpeedChange,
}: ConfigPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="config-overlay" onClick={onClose}></div>
      <div className="config-drawer">
        <div className="config-header">
          <h2>Configuration</h2>
          <button className="close-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="config-content">
          <div className="config-section">
            <h3>Input Language</h3>
            <select
              value={inputLanguage}
              onChange={(e) => onInputLanguageChange(e.target.value)}
              disabled={isListening}
              className="config-select"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="zh">Chinese</option>
            </select>
          </div>

          <div className="config-section">
            <h3>Output Language</h3>
            <select
              value={outputLanguage}
              onChange={(e) => onOutputLanguageChange(e.target.value)}
              disabled={isListening}
              className="config-select"
            >
              <option value="ja">Japanese</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ko">Korean</option>
              <option value="zh">Chinese</option>
            </select>
          </div>

          <div className="config-section">
            <h3>TTS Voice</h3>
            <select
              value={ttsVoice}
              onChange={(e) => onTtsVoiceChange(e.target.value)}
              disabled={isListening}
              className="config-select"
            >
              <option value="alloy">Alloy</option>
              <option value="echo">Echo</option>
              <option value="fable">Fable</option>
              <option value="onyx">Onyx</option>
              <option value="nova">Nova</option>
              <option value="shimmer">Shimmer</option>
            </select>
          </div>

          <div className="config-section">
            <h3>TTS Speed: {ttsSpeed.toFixed(2)}x</h3>
            <input
              type="range"
              min="0.25"
              max="2.0"
              step="0.05"
              value={ttsSpeed}
              onChange={(e) => onTtsSpeedChange(parseFloat(e.target.value))}
              disabled={isListening}
              className="config-slider"
            />
          </div>

          <div className="config-section">
            <h3>Session Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label">Translations</div>
                <div className="stat-value">{sessionStats.translationCount}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Total Audio</div>
                <div className="stat-value">{sessionStats.totalAudioTime.toFixed(1)}s</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Avg RTF</div>
                <div className="stat-value">{sessionStats.avgRTF.toFixed(3)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
