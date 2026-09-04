export interface NmtMetrics {
  latency_ms: number;
  approx_tokens: number;
  tokens_per_sec: number;
}

export interface TranslateBatchResult {
  results: Record<string, string>;
  metrics: NmtMetrics | null;
}

export class TranslationService {
  private static langMap: Record<string, string> = {
    "Hindi": "hi",
    "Bengali": "bn",
    "Tamil": "ta",
    "Telugu": "te",
    "Kannada": "kn",
    "Malayalam": "ml",
    "Marathi": "mr",
    "Gujarati": "gu",
    "Punjabi": "pa",
    "Odia": "or"
  };

  /**
   * Sends a transcript to the NMT (Machine Translation) backend to get a translated text.
   */
  static async translateText(text: string, targetLanguage: string, sourceLanguage: string = "hi"): Promise<string> {
    const apiUrl = import.meta.env.VITE_NMT_API_URL || 'http://localhost:8004/services/inference/pipeline';
    const tgtCode = this.langMap[targetLanguage] || "hi";
    
    // NMT backend requires source and target to differ.
    if (sourceLanguage === tgtCode) return text;

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          pipelineTasks: [
            {
              taskType: "translation",
              config: {
                language: {
                  sourceLanguage: sourceLanguage,
                  targetLanguage: tgtCode
                },
                serviceId: "indictrans2-indic-indic"
              }
            }
          ],
          inputData: {
            input: [
              {
                source: text
              }
            ]
          }
        })
      });

      if (!response.ok) {
        throw new Error(`NMT request failed with status: ${response.status}`);
      }

      const data = await response.json();
      return data.pipelineResponse[0].output[0].target;
    } catch (e) {
      console.warn("NMT backend failed, falling back to mock response.", e);
      // Fallback
      return `[${targetLanguage}] ${text}`;
    }
  }

  static async translateBatch(
    text: string,
    targetLanguages: string[],
    sourceLanguage: string = "hi",
    apiUrl?: string
  ): Promise<TranslateBatchResult> {
    const normalizedSource = text.trim();
    if (!normalizedSource) {
      return { results: {}, metrics: null };
    }

    const url = apiUrl || import.meta.env.VITE_NMT_API_URL || 'http://localhost:8004/services/inference/pipeline';

    const uniqueTargets = Array.from(new Set(targetLanguages));
    const languageCodes = uniqueTargets.map((langName) => ({
      langName,
      code: this.langMap[langName] || 'hi',
    }));

    const passthrough: Record<string, string> = {};
    const requests = languageCodes
      .filter(({ code, langName }) => {
        if (code === sourceLanguage) {
          passthrough[langName] = normalizedSource;
          return false;
        }
        return true;
      })
      .map(({ code }) => ({
        source: normalizedSource,
        targetLanguage: code,
      }));

    if (requests.length === 0) {
      return { results: passthrough, metrics: null };
    }

    try {
      const serviceId = sourceLanguage === 'en' ? 'indictrans2-en-indic' : 'indictrans2-indic-indic';
      const payload = {
        pipelineTasks: [
          {
            taskType: 'translation',
            config: {
              language: {
                sourceLanguage,
              },
              serviceId,
            },
          },
        ],
        inputData: {
          requests,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`NMT batch request failed with status: ${response.status}`);
      }

      const data = await response.json();
      const outputs = data?.pipelineResponse?.[0]?.output || [];

      const byCode: Record<string, string> = {};
      outputs.forEach((item: any, index: number) => {
        if (item?.targetLanguage && typeof item.target === 'string') {
          byCode[item.targetLanguage] = item.target;
          return;
        }

        // Backward compatibility: some server versions don't include targetLanguage in output.
        const req = requests[index];
        if (req && typeof item?.target === 'string') {
          byCode[req.targetLanguage] = item.target;
        }
      });

      const result: Record<string, string> = { ...passthrough };
      for (const { langName, code } of languageCodes) {
        // Skip languages already handled as passthrough (source == target).
        if (langName in passthrough) continue;
        result[langName] = byCode[code] || `[${langName}] ${normalizedSource}`;
      }
      return {
        results: result,
        metrics: (data?.pipelineResponse?.[0]?.metrics as NmtMetrics) ?? null,
      };
    } catch (e) {
      console.warn('NMT batch backend failed, falling back to mock responses.', e);
      const fallback: Record<string, string> = {};
      for (const lang of uniqueTargets) {
        fallback[lang] = `[${lang}] ${normalizedSource}`;
      }
      return { results: fallback, metrics: null };
    }
  }
}
