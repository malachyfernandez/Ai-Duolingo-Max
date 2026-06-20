// OpenRouter chat client + the tutor "contract".
//
// Every turn the model must reply with a single JSON object describing what the
// face should do, what to say out loud, and the next exercise. We keep the raw
// JSON replies in the message history so the model stays consistent.

import { EXPRESSION_NAMES } from './face.js';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export function buildSystemPrompt({ language, languageName, topic }) {
  const expr = EXPRESSION_NAMES.join(', ');
  const topicLine = topic ? `Focus the lesson around: "${topic}".` : 'Pick a useful everyday theme.';
  return `You are "Lingo", a warm, funny, expressive language tutor for someone learning ${languageName}. ${topicLine}

You teach like Duolingo: one tiny exercise at a time, gentle and encouraging, celebrating wins and softening mistakes. Keep spoken lines SHORT (one or two sentences) and mostly in English, sprinkling in the ${languageName} you are teaching.

You control an animated face. EVERY reply MUST be a single JSON object (no markdown, no prose outside the JSON) with EXACTLY this shape:
{
  "expression": one of [${expr}],
  "speech": "what you say out loud now — short, natural, spoken aloud by TTS",
  "speechLang": "BCP-47 tag for the speech voice, usually en-US",
  "feedback": "one short line grading the user's previous answer (empty string on the first turn)",
  "correct": true | false | null,            // null on the first turn
  "task": {
    "type": "translate" | "choose" | "type" | "listen",
    "prompt": "the instruction the learner reads",
    "targetText": "the ${languageName} phrase involved, if any (else empty string)",
    "targetLang": "BCP-47 tag for targetText, e.g. es-ES",
    "choices": ["..."],                       // 3-4 options for type "choose", else []
    "answer": "the exact correct answer string"
  },
  "xpAwarded": integer 0-20,                   // reward correct answers ~10, 0 on first turn or wrong
  "done": false
}

Rules:
- Start easy and get harder as they succeed.
- For "choose", put the correct answer in "choices" along with plausible distractors.
- For "listen", the learner must type what they heard; set targetText to the ${languageName} phrase and speechLang may equal targetLang so they hear it.
- "answer" must match what counts as correct (case-insensitive, trimmed).
- React with a fitting expression (happy/excited when right, encouraging/sad when wrong, thinking when posing a hard one).
- Never break character or add text outside the JSON.`;
}

export function parseTurn(text) {
  if (!text) return null;
  let s = text.trim();
  // strip code fences if present
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // otherwise grab the outermost braces
  if (s[0] !== '{') {
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a !== -1 && b !== -1 && b > a) s = s.slice(a, b + 1);
  }
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function chatTurn({ apiKey, model, messages }) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'Lingo Max',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch { /* ignore */ }
    throw new Error(`OpenRouter ${res.status}${detail ? ': ' + detail : ''}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const turn = parseTurn(content);
  if (!turn) throw new Error('Could not parse the model reply as JSON.');
  return { turn, raw: content };
}
