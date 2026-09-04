import { useRef, useEffect, useMemo } from 'react';
import styles from '../App.module.css';

interface Props {
  id: string;
  targetLang: string;
  translatedText: string;
  isTranslating: boolean;
  onTargetLangChange: (panelId: string, language: string) => void;
  variant?: 'Color1' | 'Color2' | 'Color3';
}

const LANGUAGES = [
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

export const TranslationPanel: React.FC<Props> = ({ id, targetLang, translatedText, isTranslating, onTargetLangChange, variant }) => {
  const bodyRef = useRef<HTMLDivElement>(null);

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
            {sentences.map((sentence, index) => {
              const distFromEnd = sentences.length - 1 - index;
              const isLatest = distFromEnd === 0;
              const opacity = isLatest ? 1 : distFromEnd === 1 ? 0.55 : distFromEnd === 2 ? 0.35 : 0.2;
              return (
                <div
                  key={`${sentence}-${index}`}
                  className={`${styles.sentenceItem}${isLatest ? ` ${styles.sentenceLatest}` : ''}`}
                  style={{ opacity, transition: 'opacity 0.4s ease, font-weight 0.4s ease' }}
                >
                  {sentence}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.panelPlaceholder}>
            Select a target language and speak.
            <br /> <br />
            Translations will stream here.
          </div>
        )}
        {isTranslating && <span className={styles.streamingText}>. . .</span>}
      </div>
    </div>
  );
};
