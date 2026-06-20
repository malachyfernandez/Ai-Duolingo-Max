// No-key demo "engine". It returns turn objects in exactly the same shape the
// AI produces, so the app renders both paths through one code path. This lets
// anyone try the face, voice and lip-sync before pasting a key.

export function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
}

const EXERCISES = [
  {
    expression: 'happy',
    intro: "¡Hola! I'm Lingo. Let's warm up — how do you say \"hello\"?",
    task: { type: 'choose', prompt: 'Pick "hello" in Spanish', targetText: '', targetLang: 'es-ES',
            choices: ['Hola', 'Adiós', 'Gracias', 'Por favor'], answer: 'Hola' },
  },
  {
    expression: 'encouraging',
    intro: 'Now type "thank you" in Spanish.',
    task: { type: 'type', prompt: 'Type "thank you" in Spanish', targetText: 'Gracias', targetLang: 'es-ES',
            choices: [], answer: 'gracias' },
  },
  {
    expression: 'thinking',
    intro: 'Which of these means "water"?',
    task: { type: 'choose', prompt: 'Which word means "water"?', targetText: '', targetLang: 'es-ES',
            choices: ['Agua', 'Leche', 'Pan', 'Vino'], answer: 'Agua' },
  },
  {
    expression: 'excited',
    intro: 'Listen closely and type exactly what you hear.',
    task: { type: 'listen', prompt: 'Type what you hear', targetText: 'Buenos días', targetLang: 'es-ES',
            choices: [], answer: 'buenos dias' },
  },
  {
    expression: 'neutral',
    intro: 'Last one — how do you say "goodbye"?',
    task: { type: 'choose', prompt: 'Pick "goodbye" in Spanish', targetText: '', targetLang: 'es-ES',
            choices: ['Adiós', 'Hola', 'Sí', 'No'], answer: 'Adiós' },
  },
];

const PRAISE = ['¡Perfecto!', '¡Muy bien!', 'Nailed it!', '¡Excelente!', 'You got it!'];
const SOFTEN = ['Casi — almost!', 'Not quite, but good try.', 'So close!', "Don't worry, keep going."];

export function createDemoEngine() {
  let i = -1;

  function exerciseToTurn(ex, { feedback = '', correct = null, xp = 0, speechPrefix = '' } = {}) {
    const speech = (speechPrefix ? speechPrefix + ' ' : '') + ex.intro;
    const speechLang = ex.task.type === 'listen' ? ex.task.targetLang : 'en-US';
    return {
      expression: ex.expression,
      speech,
      speechLang,
      feedback,
      correct,
      task: ex.task,
      xpAwarded: xp,
      done: false,
    };
  }

  return {
    isDemo: true,
    start() {
      i = 0;
      return exerciseToTurn(EXERCISES[0]);
    },
    answer(value) {
      const ex = EXERCISES[i];
      const correct = normalize(value) === normalize(ex.task.answer);
      const fb = correct ? PRAISE[Math.floor(Math.random() * PRAISE.length)]
                         : SOFTEN[Math.floor(Math.random() * SOFTEN.length)];
      i += 1;
      if (i >= EXERCISES.length) {
        return {
          expression: correct ? 'excited' : 'encouraging',
          speech: `${fb} That's the end of the demo — paste an OpenRouter key to keep going with a real AI tutor!`,
          speechLang: 'en-US',
          feedback: fb,
          correct,
          task: null,
          xpAwarded: correct ? 10 : 0,
          done: true,
        };
      }
      const next = EXERCISES[i];
      const turn = exerciseToTurn(next, {
        feedback: fb,
        correct,
        xp: correct ? 10 : 0,
        speechPrefix: fb,
      });
      turn.expression = correct ? 'happy' : 'encouraging';
      return turn;
    },
  };
}
