// src/lib/ai/config.ts

/**
 * Server-Side AI Configuration
 * Reads credentials strictly from process.env on the server.
 * Secrets are never exported or leaked to client components.
 */

export interface AiConfig {
  apiKey: string | null;
  model: string;
  isConfigured: boolean;
  timeoutMs: number;
  maxRetries: number;
  maxOutputTokens: number;
}

export function getAiConfig(): AiConfig {
  // Ensure this is only executed in a Node.js / Server environment
  const apiKey = process.env.GEMINI_API_KEY?.trim() || null;
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

  return {
    apiKey: apiKey && apiKey !== 'your_gemini_api_key_here' ? apiKey : null,
    model,
    isConfigured: Boolean(apiKey && apiKey !== 'your_gemini_api_key_here'),
    timeoutMs: 15000, // 15s timeout
    maxRetries: 2,
    maxOutputTokens: 2048,
  };
}

/**
 * Client-safe configuration status (NO secrets)
 */
export function getAiPublicStatus() {
  const config = getAiConfig();
  return {
    isConfigured: config.isConfigured,
    model: config.model,
    provider: 'Google Gen AI SDK (@google/genai)',
  };
}
