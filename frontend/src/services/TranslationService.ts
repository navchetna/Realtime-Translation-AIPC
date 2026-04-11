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
}
