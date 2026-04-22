import { useState, useEffect } from 'react';
import styles from '../App.module.css';
import { Mic, Volume2, AudioLines, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  onDeviceSelect: (deviceId: string) => void;
  panelCount: number;
  onPanelCountChange: (count: number) => void;
  isStreamAudioEnabled: boolean;
  streamAudioLanguage: string;
  availableStreamAudioLanguages: string[];
  streamAudioQueueSize: number;
  audioPlaybackQueueSize: number;
  isStreamingAudioActive: boolean;
  onStreamAudioEnabledChange: (enabled: boolean) => void;
  onStreamAudioLanguageChange: (language: string) => void;
  onSaveSettings: () => void;
  hasUnsavedSettings: boolean;
  settingsMessage: string;
}

export const Sidebar: React.FC<Props> = ({
  onDeviceSelect,
  panelCount,
  onPanelCountChange,
  isStreamAudioEnabled,
  streamAudioLanguage,
  availableStreamAudioLanguages,
  streamAudioQueueSize,
  audioPlaybackQueueSize,
  isStreamingAudioActive,
  onStreamAudioEnabledChange,
  onStreamAudioLanguageChange,
  onSaveSettings,
  hasUnsavedSettings,
  settingsMessage,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>('');
  
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devs => {
      const audioInputs = devs.filter(d => d.kind === 'audioinput');
      setDevices(audioInputs);
      if (audioInputs.length > 0) {
        setSelectedMic(audioInputs[0].deviceId);
        onDeviceSelect(audioInputs[0].deviceId);
      }
    }).catch(err => {
      console.error("Could not enumerate devices:", err);
    });
  }, [onDeviceSelect]);

  const handleMicChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMic(e.target.value);
    onDeviceSelect(e.target.value);
  };

  return (
    <div className={`${styles.sidebar} ${isOpen ? '' : styles.collapsed}`}>
      <button 
        className={styles.collapseBtn} 
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
      >
        {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      <div className={styles.sidebarContent} style={{ opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none' }}>
        <div className={styles.sidebarBody}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Audio Settings</h2>
            
            <div className={styles.inputGroup}>
              <label className={styles.label}>
                <Mic size={16} className={styles.streamingText} />
                Input Device
              </label>
              <select className={styles.select} value={selectedMic} onChange={handleMicChange}>
                {devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.substring(0, 5)}...`}
                  </option>
                ))}
                {devices.length === 0 && <option>Default Microphone</option>}
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>
                <Volume2 size={16} />
                Output Device
              </label>
              <select className={styles.select} disabled>
                <option>System Default (Static)</option>
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>
                Number of Languages
              </label>
              <div className={styles.toggleRow}>
                <button
                  className={styles.button}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '14px',
                  }}
                  onClick={() => onPanelCountChange(Math.max(1, panelCount - 1))}
                  disabled={panelCount <= 1}
                >
                  −
                </button>
                <div style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                }}>
                  {panelCount}
                </div>
                <button
                  className={styles.button}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '14px',
                  }}
                  onClick={() => onPanelCountChange(Math.min(4, panelCount + 1))}
                  disabled={panelCount >= 4}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Stream Audio</h2>

            <div className={styles.inputGroup}>
              <button
                type="button"
                className={`${styles.toggleButton}${isStreamAudioEnabled ? ` ${styles.toggleButtonActive}` : ''}`}
                onClick={() => onStreamAudioEnabledChange(!isStreamAudioEnabled)}
                disabled={availableStreamAudioLanguages.length === 0}
              >
                <span className={styles.label} style={{ marginBottom: 0 }}>
                  <Volume2 size={16} />
                  Stream Audio
                </span>
                <span className={styles.toggleButtonState}>{isStreamAudioEnabled ? 'On' : 'Off'}</span>
              </button>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>
                <AudioLines size={16} />
                Stream Language
              </label>
              <select
                className={styles.select}
                value={streamAudioLanguage}
                onChange={(e) => onStreamAudioLanguageChange(e.target.value)}
                disabled={availableStreamAudioLanguages.length === 0}
              >
                {availableStreamAudioLanguages.length === 0 ? (
                  <option>No active TTS-ready panel</option>
                ) : (
                  availableStreamAudioLanguages.map((language) => (
                    <option key={language} value={language}>{language}</option>
                  ))
                )}
              </select>
            </div>

            <div className={styles.streamStatus}>
              <span>
                {availableStreamAudioLanguages.length === 0
                  ? 'Select a TTS-supported panel language first'
                  : isStreamingAudioActive
                    ? 'Streaming to speakers'
                    : 'Waiting for translated audio'}
              </span>
              <span>TTS Queue: {streamAudioQueueSize} | Playback: {audioPlaybackQueueSize}</span>
            </div>
          </div>
        </div>

        <div className={styles.sidebarFooter}>
          {settingsMessage && <div className={styles.saveMessage}>{settingsMessage}</div>}
          <button
            type="button"
            className={styles.button}
            onClick={onSaveSettings}
          >
            Save Settings{hasUnsavedSettings ? ' *' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
