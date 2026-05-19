import { useRef, useEffect, useState } from 'react';
import type { TranscriptionResult, TranslationResult } from '../types';

interface TranscriptionPanelProps {
  title: string;
  transcriptions: (TranscriptionResult | TranslationResult)[];
  onClear: () => void;
  isJapanese?: boolean;
  onRequestTTS?: (text: string, index: number) => Promise<Blob | undefined>;
}

export function TranscriptionPanel({
  title,
  transcriptions,
  onClear,
  isJapanese = false,
  onRequestTTS,
}: TranscriptionPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [currentlyPlayingIndex, setCurrentlyPlayingIndex] = useState<number | null>(null);
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);

  // Auto-scroll to bottom when new transcriptions are added
  useEffect(() => {
    if (panelRef.current) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        if (panelRef.current) {
          panelRef.current.scrollTo({
            top: panelRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 100);
    }
  }, [transcriptions]);

  const playAudio = (audioBlob?: Blob) => {
    if (!audioBlob) return;

    const audio = new Audio(URL.createObjectURL(audioBlob));
    audio.play();
    audio.onended = () => URL.revokeObjectURL(audio.src);
  };

  const handleItemClick = async (item: TranscriptionResult | TranslationResult, index: number) => {
    const hasAudio = 'audioBlob' in item && item.audioBlob;

    if (hasAudio) {
      // Play existing audio
      playAudio(item.audioBlob);
    } else if (isJapanese && onRequestTTS && item.text) {
      // Generate TTS for Japanese translations that don't have audio yet
      console.log('[TranscriptionPanel] Requesting TTS for:', item.text.substring(0, 50));
      try {
        const audioBlob = await onRequestTTS(item.text, index);
        if (audioBlob) {
          playAudio(audioBlob);
        }
      } catch (error) {
        console.error('[TranscriptionPanel] TTS request failed:', error);
      }
    }
  };

  const playAllTranscriptions = async () => {
    if (!isJapanese || !onRequestTTS || transcriptions.length === 0 || isPlayingAll) {
      return;
    }

    setIsPlayingAll(true);
    console.log('[TranscriptionPanel] Playing all transcriptions...');

    try {
      // Generate audio for all transcriptions (in parallel for faster loading)
      const audioPromises = transcriptions.map(async (item, index) => {
        const hasAudio = 'audioBlob' in item && item.audioBlob;
        if (hasAudio) {
          return item.audioBlob;
        } else if (item.text && onRequestTTS) {
          console.log(`[TranscriptionPanel] Generating TTS for item ${index + 1}/${transcriptions.length}`);
          return await onRequestTTS(item.text, index);
        }
        return undefined;
      });

      const audioBlobs = await Promise.all(audioPromises);

      // Create audio elements and play sequentially
      const audioElements: HTMLAudioElement[] = [];
      for (const blob of audioBlobs) {
        if (blob) {
          const audio = new Audio(URL.createObjectURL(blob));
          audioElements.push(audio);
        }
      }

      // Play audio elements in sequence with highlighting
      const playNext = (index: number) => {
        if (index >= audioElements.length) {
          console.log('[TranscriptionPanel] Finished playing all audio');
          setIsPlayingAll(false);
          setCurrentlyPlayingIndex(null);
          // Clean up URLs
          audioElements.forEach((audio) => URL.revokeObjectURL(audio.src));
          return;
        }

        // Highlight the current item
        setCurrentlyPlayingIndex(index);

        const audio = audioElements[index];
        audio.onended = () => {
          setCurrentlyPlayingIndex(null);
          playNext(index + 1);
        };
        audio.onerror = () => {
          console.error('[TranscriptionPanel] Audio playback error, skipping to next');
          setCurrentlyPlayingIndex(null);
          playNext(index + 1);
        };
        audio.play().catch((err) => {
          console.error('[TranscriptionPanel] Failed to play audio:', err);
          setCurrentlyPlayingIndex(null);
          playNext(index + 1);
        });
      };

      playNext(0);
    } catch (error) {
      console.error('[TranscriptionPanel] Play all failed:', error);
      setIsPlayingAll(false);
      setCurrentlyPlayingIndex(null);
    }
  };

  return (
    <div className="transcription-panel">
      <div className="panel-header">
        <h3>{title}</h3>
        <div className="panel-actions">
          {isJapanese && onRequestTTS && transcriptions.length > 0 && (
            <button
              className="play-all-btn"
              onClick={playAllTranscriptions}
              disabled={isPlayingAll}
              title="Play all translations"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              {isPlayingAll ? 'Playing...' : 'Play All'}
            </button>
          )}
          <button className="clear-btn" onClick={onClear} title="Clear">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      </div>

      <div className="transcriptions-list" ref={panelRef}>
        {transcriptions.length === 0 ? (
          <div className="empty-state">
            <span>{isJapanese ? '🇯🇵' : '🇬🇧'}</span>
            <p>No transcriptions yet</p>
          </div>
        ) : (
          transcriptions.map((item, idx) => {
            const hasAudio = 'audioBlob' in item && item.audioBlob;
            const isClickable = hasAudio || (isJapanese && onRequestTTS);
            const isCurrentlyPlaying = currentlyPlayingIndex === idx;

            return (
              <div
                key={idx}
                className={`transcription-item ${isClickable ? 'clickable' : ''} ${isCurrentlyPlaying ? 'playing' : ''}`}
                onClick={() => isClickable && handleItemClick(item, idx)}
                title={
                  hasAudio
                    ? 'Click to play audio'
                    : isJapanese && onRequestTTS
                    ? 'Click to generate and play audio'
                    : undefined
                }
              >
                <div className="transcription-text">{item.text}</div>
                <div className="transcription-meta">
                  <span className="timestamp">
                    {item.timestamp.toLocaleTimeString()}
                  </span>
                  {isClickable && (
                    <span className="play-icon" title={hasAudio ? 'Has audio' : 'Generate audio'}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        {hasAudio ? (
                          <path d="M8 5v14l11-7z" />
                        ) : (
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                        )}
                      </svg>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
