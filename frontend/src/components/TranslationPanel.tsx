import { useRef, useEffect } from 'react';
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
          <p style={{ whiteSpace: 'pre-wrap' }}>{translatedText}</p>
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
