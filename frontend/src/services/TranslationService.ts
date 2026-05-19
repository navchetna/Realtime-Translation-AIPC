/**
 * Translation Service
 * Handles text translation using Ollama
 */

import { API_CONFIG, LLM_TRANSLATION_PROMPT } from '../config/apiConfig';
import type { TranslationMetrics } from '../types';

export class TranslationService {
  private readonly baseUrl: string;
  private readonly modelName: string;

  constructor(baseUrl: string = API_CONFIG.LLM_URL, modelName: string = API_CONFIG.OLLAMA_MODEL) {
    this.baseUrl = baseUrl;
    this.modelName = modelName;
  }

  /**
   * Translate text from source to target language
   */
  async translateText(
    text: string,
    sourceLang: string = 'en',
    targetLang: string = 'ja'
  ): Promise<{ text: string; metrics: TranslationMetrics }> {
    const startTime = performance.now();

    try {
      console.log('[Translation] Translating:', {
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        sourceLang,
        targetLang,
      });

      // Format the translation prompt (single message, no conversation history)
      const formattedPrompt = LLM_TRANSLATION_PROMPT
        .replace('{sourceLang}', this.getLanguageName(sourceLang))
        .replace('{targetLang}', this.getLanguageName(targetLang))
        .replace('{text}', text);

      // Call Ollama API (OpenAI-compatible format)
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            {
              role: 'user',
              content: formattedPrompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 256,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Translation] API error response:', errorText);
        throw new Error(`Ollama API failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[Translation] Raw API response:', JSON.stringify(data, null, 2));

      const translatedText = data.choices?.[0]?.message?.content?.trim() || '';

      if (!translatedText) {
        console.warn('[Translation] Empty translation received! Response structure:', {
          hasChoices: !!data.choices,
          choicesLength: data.choices?.length,
          firstChoice: data.choices?.[0],
        });
      }

      const endTime = performance.now();
      const latency = endTime - startTime;

      // Calculate tokens per second from API response
      const completionTokens = data.usage?.completion_tokens || Math.ceil(translatedText.split(/\s+/).length * 1.3);
      const tokensPerSec = completionTokens > 0 ? (completionTokens / latency) * 1000 : 0;

      console.log('[Translation] Completed:', {
        translatedText: translatedText.substring(0, 100) + (translatedText.length > 100 ? '...' : ''),
        translatedTextLength: translatedText.length,
        latency: `${latency.toFixed(0)}ms`,
        completionTokens: completionTokens,
        tokensPerSec: tokensPerSec.toFixed(1),
        model: data.model,
        usage: data.usage,
      });

      return {
        text: translatedText,
        metrics: {
          tokensPerSec,
          latency_ms: latency,
        },
      };
    } catch (error) {
      console.error('[Translation] Error:', error);
      throw error;
    }
  }

  /**
   * Get full language name from code
   */
  private getLanguageName(code: string): string {
    const languageNames: Record<string, string> = {
      en: 'English',
      ja: 'Japanese',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      ko: 'Korean',
      zh: 'Chinese',
      ar: 'Arabic',
      hi: 'Hindi',
    };

    return languageNames[code] || code;
  }

  /**
   * Check service health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      // Mock service is always "healthy" for development
      return true;
    }
  }
}

export const translationService = new TranslationService();
