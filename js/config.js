// Defaults + language catalog. Voice tags are BCP-47 so the browser can match
// an installed voice; falls back gracefully when a voice isn't available.

export const DEFAULT_MODEL = 'openai/gpt-4o-mini';

export const LANGUAGES = [
  { name: 'Spanish',    voice: 'es-ES', flag: '🇪🇸' },
  { name: 'French',     voice: 'fr-FR', flag: '🇫🇷' },
  { name: 'German',     voice: 'de-DE', flag: '🇩🇪' },
  { name: 'Italian',    voice: 'it-IT', flag: '🇮🇹' },
  { name: 'Portuguese', voice: 'pt-BR', flag: '🇧🇷' },
  { name: 'Japanese',   voice: 'ja-JP', flag: '🇯🇵' },
  { name: 'Korean',     voice: 'ko-KR', flag: '🇰🇷' },
  { name: 'Mandarin',   voice: 'zh-CN', flag: '🇨🇳' },
  { name: 'Dutch',      voice: 'nl-NL', flag: '🇳🇱' },
  { name: 'Hindi',      voice: 'hi-IN', flag: '🇮🇳' },
];

export const STORAGE = {
  key: 'lingomax.openrouter_key',
  model: 'lingomax.model',
  voice: 'lingomax.voice',
  lang: 'lingomax.lang',
};
