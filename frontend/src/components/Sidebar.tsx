import { useState, useEffect } from 'react';
import styles from '../App.module.css';
import { Mic, Volume2, User, AudioLines, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  onDeviceSelect: (deviceId: string) => void;
}

export const Sidebar: React.FC<Props> = ({ onDeviceSelect }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>('');
  
  // Clone state
  const [cloneName, setCloneName] = useState('');
  const [isRecordingClone, setIsRecordingClone] = useState(false);
  const [cloneStatus, setCloneStatus] = useState<'' | 'prompt' | 'success'>('');
  
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

  const handleCloneRecord = () => {
    if (!cloneName.trim()) return;
    
    setIsRecordingClone(true);
    setCloneStatus('prompt');

    // Mocks 10s recording
    setTimeout(() => {
      setIsRecordingClone(false);
      setCloneStatus('success');
      
      // Clear success message after 5 seconds
      setTimeout(() => {
         setCloneStatus('');
         setCloneName('');
      }, 5000);
      
    }, 10000);
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
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Voice Cloning</h2>
          
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              <User size={16} />
              User Name
            </label>
            <input 
              type="text" 
              className={styles.input} 
              placeholder="e.g. John Doe" 
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              disabled={isRecordingClone}
            />
          </div>

          <button 
            className={`${styles.button} ${isRecordingClone ? styles.recording : ''}`}
            onClick={handleCloneRecord}
            disabled={!cloneName.trim() || isRecordingClone}
          >
            <AudioLines size={18} />
            {isRecordingClone ? 'Recording... (10s)' : 'Record Voice Profile'}
          </button>

          {cloneStatus === 'prompt' && (
            <div className={`${styles.clonePrompt} flash-text`}>
              <strong>Please read this text aloud:</strong> <br/>
              "The quick brown fox jumps over the lazy dog. The sun sets quickly over the calm, blue ocean."
            </div>
          )}

          {cloneStatus === 'success' && (
            <div className={styles.toast}>
              <CheckCircle size={16} style={{display: 'inline', marginBottom: '-3px', marginRight: '4px'}} />
              Voice set to user <strong>{cloneName}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
