import { useRef, useEffect, useMemo, useState } from 'react';
import styles from '../App.module.css';

interface Props {
  id: string;
  targetLang: string;
  translatedText: string;
  isTranslating: boolean;
  onTargetLangChange: (panelId: string, language: string) => void;
  onSpeakSentence: (sentence: string, targetLanguage: string) => Promise<void>;
  variant?: 'Color1' | 'Color2' | 'Color3';
}

const LANGUAGES = [
  "English",
  "Hindi", 
  "Bengali", 
  "Tamil", 
  "Telugu", 
  "Kannada", 
  "Malayalam", 
  "Marathi", 
  "Gujarati", 
  "Punjabi", 
  "Odia"
];

export const TranslationPanel: React.FC<Props> = ({ id, targetLang, translatedText, isTranslating, onTargetLangChange, onSpeakSentence, variant }) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [selectedChunk, setSelectedChunk] = useState('');
  const [isSpeakingSentence, setIsSpeakingSentence] = useState(false);
  const [speechError, setSpeechError] = useState('');

  const translatedChunks = useMemo(() => {
    return translatedText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [translatedText]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [translatedText]);

  const handleChunkClick = async (chunk: string) => {
    setSelectedChunk(chunk);
    setSpeechError('');
    setIsSpeakingSentence(true);
    try {
      await onSpeakSentence(chunk, targetLang);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Audio playback failed';
      setSpeechError(message);
    } finally {
      setIsSpeakingSentence(false);
    }
  };

  return (
    <div className={`${styles.panel} ${variant ? styles['panel' + variant] : ''}`} key={id}>
      <div className={styles.panelHeader}>
        <div className={styles.inputGroup} style={{ marginBottom: 0, width: '100%' }}>
          <select 
            className={styles.select} 
            value={targetLang}
            onChange={(e) => {
              onTargetLangChange(id, e.target.value);
            }}
          >
            {LANGUAGES.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.panelBody} ref={bodyRef}>
        {translatedText ? (
          <div className={styles.sentenceList}>
            {translatedChunks.map((chunk, index) => (
              <button
                type="button"
                key={`${chunk}-${index}`}
                className={`${styles.sentenceButton}${selectedChunk === chunk ? ` ${styles.sentenceButtonSelected}` : ''}`}
                onClick={() => {
                  void handleChunkClick(chunk);
                }}
                disabled={isSpeakingSentence}
                title="Click to play this translated chunk"
              >
                {chunk}
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.panelPlaceholder}>
            Select a target language and speak.
            <br /> <br />
            Translations will stream here. Click any sentence to hear audio.
          </div>
        )}
        {isTranslating && <span className={styles.streamingText}>. . .</span>}
        {speechError && <div className={styles.speechError}>{speechError}</div>}
      </div>
    </div>
  );
};
