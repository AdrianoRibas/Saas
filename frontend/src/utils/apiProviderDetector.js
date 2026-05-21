// API Provider Detection and Auto-Configuration
export const API_PROVIDERS = {
  GEMINI: {
    name: 'Google Gemini',
    // URL NATIVA do Gemini (não OpenAI-compatible)
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    keyPattern: /^AIza/,
    isGemini: true // Flag para identificar que usa API nativa
  },
  OPENAI: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    keyPattern: /^sk-(?!ant-)/,
    isGemini: false
  },
  ANTHROPIC: {
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    keyPattern: /^sk-ant-/,
    isGemini: false
  },
  DEEPSEEK: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    keyPattern: /^sk-[a-f0-9]{32}$/,
    isGemini: false
  }
};

/**
 * Detects the API provider based on the API key format
 * @param {string} apiKey - The API key to analyze
 * @returns {object|null} - Provider configuration or null if not detected
 */
export function detectProvider(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return null;

  const trimmedKey = apiKey.trim();

  for (const [providerKey, config] of Object.entries(API_PROVIDERS)) {
    if (config.keyPattern.test(trimmedKey)) {
      return {
        providerKey,
        ...config
      };
    }
  }

  return null;
}

/**
 * Shows a specific configuration field
 * @param {HTMLElement} field - The field element to show
 */
export function showField(field) {
  if (!field) return;
  field.classList.remove('hidden');
}

/**
 * Hides a specific configuration field
 * @param {HTMLElement} field - The field element to hide
 */
export function hideField(field) {
  if (!field) return;
  field.classList.add('hidden');
}
