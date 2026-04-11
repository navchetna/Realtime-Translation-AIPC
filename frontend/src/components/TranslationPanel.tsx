import { useState, useEffect } from 'react';
import styles from '../App.module.css';
import { TranslationService } from '../services/TranslationService';

interface Props {
  id: string;
  defaultLang: string;
  sourceText: string;
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

export const TranslationPanel: React.FC<Props> = ({ id, defaultLang, sourceText, variant }) => {
  const [targetLang, setTargetLang] = useState(defaultLang);
  const [displayedText, setDisplayedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    if (!sourceText) return;
    
    let isCancelled = false;

    const translate = async () => {
      setIsTranslating(true);
      try {
        const result = await TranslationService.translateText(sourceText, targetLang);
        if (!isCancelled) {
          setIsTranslating(false);
          streamText(result);
        }
      } catch (err) {
        setIsTranslating(false);
      }
    };

    translate();

    return () => {
      isCancelled = true;
    };
  }, [sourceText, targetLang]);

  // Simulate streaming effect
  const streamText = (fullText: string) => {
    let index = 0;
    setDisplayedText("");
    
    const interval = setInterval(() => {
      if (index < fullText.length - 1) {
        setDisplayedText(prev => prev + fullText[index]);
        index++;
      } else {
        setDisplayedText(fullText);
        clearInterval(interval);
      }
    }, 20); // 20ms per character
  };

  return (
    <div className={`${styles.panel} ${variant ? styles['panel' + variant] : ''}`} key={id}>
      <div className={styles.panelHeader}>
        <div className={styles.inputGroup} style={{ marginBottom: 0, width: '100%' }}>
          <select 
            className={styles.select} 
            value={targetLang}
            onChange={(e) => {
              setTargetLang(e.target.value);
              // Clear previous texts immediately on switch if we want
              setDisplayedText(""); 
            }}
          >
            {LANGUAGES.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.panelBody}>
        {isTranslating ? (
                   <span className={styles.streamingText}>. . .</span>
        ) : displayedText ? (
          <p>{displayedText}</p>
        ) : (
          <div className={styles.panelPlaceholder}>
            Select a target language and speak.
            <br /> <br />
            Translations will stream here.
          </div>
        )}
      </div>
    </div>
  );
};
