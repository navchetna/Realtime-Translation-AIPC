const parsePositiveIntEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBooleanEnv = (value: string | undefined, fallback: boolean) => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const DEFAULT_PREDEFINED_SUMMARY_TEXT = `ಇಂಟೆಲ್ ಎರಡು ಪ್ರಮುಖ ಉತ್ಪನ್ನಗಳನ್ನು ಪರಿಚಯಿಸಿದೆ: ಪ್ಯಾಂಥರ್ ಲೇಕ್ (ಕೋರ್ ಅಲ್ಟ್ರಾ ಸೀರೀಸ್ 3) ಮತ್ತು ವೈಲ್ಡ್‌ಕ್ಯಾಟ್ ಲೇಕ್ (ಕೋರ್ 3), ಇವು 18ಎ ಪ್ರಕ್ರಿಯೆ ತಂತ್ರಜ್ಞಾನವನ್ನು ಆಧರಿಸಿವೆ।
ಪ್ಯಾಂಥರ್ ಲೇಕ್‌ನಲ್ಲಿ ಗಮನಾರ್ಹ ಸುಧಾರಣೆಗಳಿವೆ: 27 ಗಂಟೆಗಳವರೆಗೆ ಬ್ಯಾಟರಿ ಸಾಮರ್ಥ್ಯ, 77 ಪ್ರತಿಶತ ಹೆಚ್ಚು ವೇಗದ ಗ್ರಾಫಿಕ್ಸ್, 60 ಪ್ರತಿಶತ ವೇಗವಾದ ಕೇಂದ್ರ ಸಂಸ್ಕರಣ ಘಟಕದ ಕಾರ್ಯಕ್ಷಮತೆ ಮತ್ತು ದ್ವಿಗುಣವಾದ ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಪ್ರದರ್ಶನ।
ಪ್ಯಾಂಥರ್ ಲೇಕ್ ಅಭಿವೃದ್ಧಿಯಲ್ಲಿ ಇಂಟೆಲ್ ಭಾರತದ ತಂಡ ಮಹತ್ವದ ಪಾತ್ರವಹಿಸಿದೆ — ಸಿಲಿಕಾನ್ ವಿನ್ಯಾಸದಿಂದ ಹಿಡಿದು ಸಂಪೂರ್ಣ ವ್ಯವಸ್ಥೆಯ ಇಂಜಿನಿಯರಿಂಗ್‌ವರೆಗೆ ಅವರ ಕೊಡುಗೆ ಇದೆ।
ವೈಲ್ಡ್‌ಕ್ಯಾಟ್ ಲೇಕ್‌ನ ಉದ್ದೇಶ ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆಯನ್ನು ಸಾಮಾನ್ಯ ಕಂಪ್ಯೂಟರ್‌ಗಳಿಗೂ ಸುಲಭವಾಗಿ, ಕೈಗೆಟುಕುವ ದರದಲ್ಲಿ ತಲುಪಿಸುವುದು; ಇದರ ಸಂಪೂರ್ಣ ಇಂಜಿನಿಯರಿಂಗ್ ಕೆಲಸವನ್ನು ಭಾರತ ತಂಡವೇ ನಿರ್ವಹಿಸಿದೆ।
ಇಂಟೆಲ್ ಭಾರತವು ವ್ಯಾಪಕ ಪರಿಸರ ವ್ಯವಸ್ಥೆಯೊಂದಿಗೆ ಕೈಜೋಡಿಸಿ ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಮಾದರಿಗಳು, ಶಿಕ್ಷಣ ಮತ್ತು ಉದ್ಯಮ ಅನ್ವಯಿಕೆಗಳು, ವಿಶ್ವವಿದ್ಯಾಲಯ ಕೇಂದ್ರಗಳು, ಉತ್ಪಾದನಾ ಭಾಗಸಹಕಾರ ಹಾಗೂ ಸರ್ಕಾರಿ ಉಪಕ್ರಮಗಳಲ್ಲಿ ಸಕ್ರಿಯವಾಗಿ ಕೆಲಸ ಮಾಡುತ್ತಿದೆ।`;

export const MIN_TRANSCRIPT_BUFFER_WORDS = parsePositiveIntEnv(
  import.meta.env['VITE_MIN_TRANSCRIPT_BUFFER_WORDS'],
  5,
);

export const ENABLE_SENTENCE_COMPLETENESS_BUFFER = parseBooleanEnv(
  import.meta.env['VITE_ENABLE_SENTENCE_COMPLETENESS_BUFFER'],
  false,
);

export const PREDEFINED_SUMMARY_TEXT =
  import.meta.env['VITE_PREDEFINED_SUMMARY_TEXT']?.replace(/\\n/g, '\n') ||
  DEFAULT_PREDEFINED_SUMMARY_TEXT;