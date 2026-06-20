# Lingo Max 🦜

An AI-powered language tutor with an **expressive talking face**. You bring your
own [OpenRouter](https://openrouter.ai) key; the model runs the whole lesson —
it picks exercises, grades you, and decides how the face should react. Speech and
lip-sync run right in the browser, so there's no server and nothing is stored
anywhere but your own machine.

**Live demo:** https://malachyfernandez.github.io/Ai-Duolingo-Max/
(try the no-key demo first, then paste a key to learn for real)

## How it works

- **Brain — OpenRouter.** Each turn the model returns a single JSON object:
  `{ expression, speech, task, feedback, correct, xpAwarded, … }`. The app never
  hard-codes lesson content; the model drives everything.
- **Voice + lip-sync — Web Speech API.** The browser's built-in TTS speaks each
  line for free and fires word-boundary events that drive the mouth animation.
  `js/tts.js` is a thin, swappable provider so a network voice (ElevenLabs/OpenAI)
  can drop in later.
- **Face — parametric SVG.** `js/face.js` builds one face and animates a small set
  of numbers (brow angle, eye openness, gaze, mouth curve + openness) toward a
  target expression every frame. The same mouth path encodes both emotion (curve)
  and lip-sync (openness): happy, sad, angry, surprised, thinking, excited,
  encouraging, neutral.
- **Demo mode.** `js/lessons.js` is a scripted lesson that returns turns in the
  exact same shape as the AI, so you can play with the face/voice with no key.

## Run locally

It's a static site — serve the folder over HTTP (ES modules need `http://`, not
`file://`):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Paste an OpenRouter key in **Settings ⚙️**. The key lives only in your browser's
`localStorage`.

## Files

| File | Role |
|------|------|
| `index.html` | layout + screens |
| `css/styles.css` | styling |
| `js/face.js` | SVG face: expressions + lip-sync |
| `js/tts.js` | text-to-speech (Web Speech API) |
| `js/ai.js` | OpenRouter client + tutor JSON contract |
| `js/lessons.js` | no-key demo engine |
| `js/config.js` | defaults + language list |
| `js/app.js` | UI wiring + lesson loop |
