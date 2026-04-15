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
  const [selectedSentence, setSelectedSentence] = useState('');
  const [isSpeakingSentence, setIsSpeakingSentence] = useState(false);
  const [speechError, setSpeechError] = useState('');

  const sentences = useMemo(() => {
    const result: string[] = [];
    const lines = translatedText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    for (const line of lines) {
      const parts = line.match(/[^.!?।]+[.!?।]?/g);
      if (!parts || parts.length === 0) {
        result.push(line);
        continue;
      }

      for (const part of parts) {
        const sentence = part.trim();
        if (sentence) result.push(sentence);
      }
    }

    return result;
  }, [translatedText]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [translatedText]);

  const handleSentenceClick = async (sentence: string) => {
    setSelectedSentence(sentence);
    setSpeechError('');
    setIsSpeakingSentence(true);
    try {
      await onSpeakSentence(sentence, targetLang);
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
            {sentences.map((sentence, index) => (
              <button
                type="button"
                key={`${sentence}-${index}`}
                className={`${styles.sentenceButton}${selectedSentence === sentence ? ` ${styles.sentenceButtonSelected}` : ''}`}
                onClick={() => {
                  void handleSentenceClick(sentence);
                }}
                disabled={isSpeakingSentence}
                title="Click to play this sentence"
              >
                {sentence}
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
