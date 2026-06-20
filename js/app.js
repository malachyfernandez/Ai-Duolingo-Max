import { Face } from './face.js';
import { WebSpeechTTS } from './tts.js';
import { chatTurn, buildSystemPrompt } from './ai.js';
import { createDemoEngine } from './lessons.js';
import { LANGUAGES, DEFAULT_MODEL, STORAGE } from './config.js';

// ---------- element refs ----------
const $ = (id) => document.getElementById(id);
const els = {
  faceHost: $('face-host'),
  stats: $('stats'), streak: $('stat-streak'), xp: $('stat-xp'), hearts: $('stat-hearts'),
  welcome: $('welcome'), lesson: $('lesson'),
  prompt: $('prompt'), taskArea: $('task-area'), feedback: $('feedback'), checkBtn: $('check-btn'),
  bubble: $('speech-bubble'), bubbleText: $('speech-text'), replayBtn: $('replay-btn'),
  langSelect: $('lang-select'), topicInput: $('topic-input'),
  startAi: $('start-ai'), startDemo: $('start-demo'), keyHint: $('key-hint'),
  settingsOverlay: $('settings-overlay'), openSettings: $('open-settings'), closeSettings: $('close-settings'),
  apiKey: $('api-key'), modelInput: $('model-input'), voiceSelect: $('voice-select'),
  testVoice: $('test-voice'), clearKey: $('clear-key'),
};

// ---------- core singletons ----------
const face = new Face(els.faceHost);
const tts = new WebSpeechTTS();

const state = {
  engine: null,
  task: null,
  selectedChoice: null,
  answering: false,
  busy: false,
  xp: 0,
  streak: 0,
  hearts: 5,
  lastSpeech: '',
  lastLang: 'en-US',
};

// ---------- persistence ----------
const load = (k, d = '') => localStorage.getItem(k) ?? d;
const save = (k, v) => localStorage.setItem(k, v);

// ---------- setup UI ----------
function initLanguages() {
  els.langSelect.innerHTML = LANGUAGES
    .map((l) => `<option value="${l.name}" data-voice="${l.voice}">${l.flag} ${l.name}</option>`)
    .join('');
  const saved = load(STORAGE.lang);
  if (saved) els.langSelect.value = saved;
}

function initVoices() {
  const fill = () => {
    const voices = tts.listVoices();
    if (!voices.length) { els.voiceSelect.innerHTML = '<option value="">(system default)</option>'; return; }
    els.voiceSelect.innerHTML = voices
      .map((v) => `<option value="${v.name}">${v.name} — ${v.lang}</option>`)
      .join('');
    const saved = load(STORAGE.voice);
    if (saved && voices.some((v) => v.name === saved)) {
      els.voiceSelect.value = saved;
    } else {
      const en = voices.find((v) => /^en/i.test(v.lang));
      if (en) els.voiceSelect.value = en.name;
    }
  };
  fill();
  if (tts.supported) tts.synth.onvoiceschanged = fill;
}

function initSettingsFields() {
  els.apiKey.value = load(STORAGE.key);
  els.modelInput.value = load(STORAGE.model) || DEFAULT_MODEL;
  updateKeyHint();
}

function updateKeyHint() {
  const has = !!load(STORAGE.key);
  els.keyHint.textContent = has
    ? 'OpenRouter key detected — Start with AI is ready.'
    : 'No key yet — “Start with AI” will ask for one. The demo needs nothing.';
  els.keyHint.classList.toggle('ok', has);
}

// ---------- speaking + face ----------
function selectedVoiceName() {
  return els.voiceSelect.value || load(STORAGE.voice) || undefined;
}

function say(text, lang = 'en-US') {
  if (!text) return;
  state.lastSpeech = text;
  state.lastLang = lang;
  els.bubble.hidden = false;
  els.bubbleText.textContent = text;

  const isEnglish = lang.toLowerCase().startsWith('en');
  face.talkStart();
  if (!tts.supported) {
    const est = Math.max(1200, (text.length / 12) * 1000);
    setTimeout(() => face.talkStop(), est);
    return;
  }
  tts.speak(text, {
    lang,
    voiceName: isEnglish ? selectedVoiceName() : undefined,
    onBoundary: () => face.nudge(),
    onEnd: () => face.talkStop(),
  });
}

// ---------- stats ----------
function renderHearts() {
  let html = '';
  for (let i = 0; i < 5; i++) html += `<span class="heart ${i < state.hearts ? '' : 'empty'}">❤️</span>`;
  els.hearts.innerHTML = html;
}
function renderStats() {
  els.streak.textContent = state.streak;
  els.xp.textContent = state.xp;
  renderHearts();
}

// ---------- lesson flow ----------
async function startLesson(engine) {
  state.engine = engine;
  state.xp = 0; state.streak = 0; state.hearts = 5;
  els.welcome.hidden = true;
  els.lesson.hidden = false;
  els.stats.hidden = false;
  renderStats();
  await runTurn(() => engine.start());
}

// Wraps an engine call (start/answer) with busy handling + error surfacing.
async function runTurn(fn) {
  state.busy = true;
  setCheckLoading(true);
  try {
    const turn = await fn();
    applyTurn(turn);
  } catch (err) {
    face.setExpression('sad');
    say(`Hmm, something went wrong: ${err.message}`, 'en-US');
    showFeedback(false, err.message);
  } finally {
    state.busy = false;
    setCheckLoading(false);
  }
}

function applyTurn(turn) {
  if (!turn) return;
  // award xp/feedback from the (previous-answer) grading carried on this turn
  if (typeof turn.xpAwarded === 'number' && turn.xpAwarded > 0) state.xp += turn.xpAwarded;
  if (turn.correct === true) state.streak += 1;
  if (turn.correct === false) { state.streak = 0; state.hearts = Math.max(0, state.hearts - 1); }
  renderStats();

  face.setExpression(turn.expression || 'neutral');
  say(turn.speech || '', turn.speechLang || 'en-US');

  if (turn.feedback) showFeedback(turn.correct, turn.feedback, turn.task ? null : undefined);
  else hideFeedback();

  if (turn.done || !turn.task || state.hearts <= 0) {
    renderFinish(turn);
    return;
  }
  renderTask(turn.task);
}

function renderTask(task) {
  state.task = task;
  state.selectedChoice = null;
  state.answering = false;
  els.prompt.textContent = task.prompt || '';
  els.taskArea.innerHTML = '';
  els.checkBtn.textContent = 'Check';
  els.checkBtn.disabled = false;

  if (task.type === 'choose' && Array.isArray(task.choices) && task.choices.length) {
    const grid = document.createElement('div');
    grid.className = 'choices';
    task.choices.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = c;
      b.addEventListener('click', () => {
        if (state.answering) return;
        grid.querySelectorAll('.choice').forEach((x) => x.classList.remove('selected'));
        b.classList.add('selected');
        state.selectedChoice = c;
      });
      grid.appendChild(b);
    });
    els.taskArea.appendChild(grid);
    els.checkBtn.disabled = true;
    // enable check once a choice is picked
    grid.addEventListener('click', () => { els.checkBtn.disabled = !state.selectedChoice; });
  } else {
    if (task.type === 'listen' && task.targetText) {
      const play = document.createElement('button');
      play.className = 'ghost-btn';
      play.type = 'button';
      play.textContent = '🔊 Play again';
      play.addEventListener('click', () => say(task.targetText, task.targetLang || 'es-ES'));
      els.taskArea.appendChild(play);
      // speak it once now
      setTimeout(() => say(task.targetText, task.targetLang || 'es-ES'), 350);
    }
    const input = document.createElement('input');
    input.className = 'answer-input';
    input.type = 'text';
    input.autocomplete = 'off';
    input.placeholder = 'Type your answer…';
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') onCheck(); });
    els.taskArea.appendChild(input);
    setTimeout(() => input.focus(), 50);
  }
}

function readAnswer() {
  if (state.task.type === 'choose') return state.selectedChoice || '';
  const input = els.taskArea.querySelector('.answer-input');
  return input ? input.value.trim() : '';
}

function markChoiceResult(value) {
  if (state.task.type !== 'choose') return;
  const answer = (state.task.answer || '').toString();
  els.taskArea.querySelectorAll('.choice').forEach((b) => {
    if (b.textContent === answer) b.classList.add('correct');
    if (b.textContent === value && value !== answer) b.classList.add('wrong');
    b.classList.add('locked');
  });
}

async function onCheck() {
  if (state.busy || state.answering) return;
  const value = readAnswer();
  if (!value) return;
  state.answering = true;
  markChoiceResult(value);
  await runTurn(() => state.engine.answer(value));
}

function showFeedback(correct, text, _) {
  els.feedback.hidden = false;
  els.feedback.className = 'feedback ' + (correct === false ? 'bad' : 'good');
  els.feedback.textContent = text;
}
function hideFeedback() { els.feedback.hidden = true; }

function renderFinish(turn) {
  state.task = null;
  const outOfHearts = state.hearts <= 0 && !turn.done;
  els.prompt.textContent = outOfHearts ? 'Out of hearts!' : 'Session complete 🎉';
  els.taskArea.innerHTML = `<div class="feedback good">You earned <strong>${state.xp} XP</strong> this session.</div>`;
  els.checkBtn.textContent = 'Start again';
  els.checkBtn.disabled = false;
  if (!outOfHearts) face.setExpression('excited');
}

function setCheckLoading(on) {
  if (!state.task && !on) return;
  if (on) { els.checkBtn.disabled = true; els.checkBtn.textContent = '…'; }
}

// ---------- AI engine ----------
function createAiEngine({ apiKey, model, language }) {
  const lang = LANGUAGES.find((l) => l.name === language) || LANGUAGES[0];
  const messages = [{
    role: 'system',
    content: buildSystemPrompt({ language: lang.voice, languageName: lang.name, topic: els.topicInput.value.trim() }),
  }];
  async function turn(userPayload) {
    messages.push({ role: 'user', content: JSON.stringify(userPayload) });
    const { turn, raw } = await chatTurn({ apiKey, model, messages });
    messages.push({ role: 'assistant', content: raw });
    return turn;
  }
  return {
    isDemo: false,
    start: () => turn({ event: 'start' }),
    answer: (value) => turn({ event: 'answer', value }),
  };
}

// ---------- event wiring ----------
els.checkBtn.addEventListener('click', () => {
  if (!state.task) { resetToWelcome(); return; }
  onCheck();
});

els.replayBtn.addEventListener('click', () => say(state.lastSpeech, state.lastLang));

els.startDemo.addEventListener('click', () => {
  save(STORAGE.lang, els.langSelect.value);
  startLesson(createDemoEngine());
});

els.startAi.addEventListener('click', () => {
  const key = load(STORAGE.key) || els.apiKey.value.trim();
  if (!key) {
    updateKeyHint();
    openSettings();
    els.apiKey.focus();
    return;
  }
  save(STORAGE.key, key);
  save(STORAGE.lang, els.langSelect.value);
  const model = (load(STORAGE.model) || els.modelInput.value.trim() || DEFAULT_MODEL);
  save(STORAGE.model, model);
  startLesson(createAiEngine({ apiKey: key, model, language: els.langSelect.value }));
});

function resetToWelcome() {
  tts.cancel();
  face.talkStop();
  face.setExpression('happy');
  els.lesson.hidden = true;
  els.bubble.hidden = true;
  els.stats.hidden = true;
  els.welcome.hidden = false;
}

// settings modal
function openSettings() { els.settingsOverlay.hidden = false; }
function closeSettings() {
  save(STORAGE.key, els.apiKey.value.trim());
  save(STORAGE.model, els.modelInput.value.trim() || DEFAULT_MODEL);
  save(STORAGE.voice, els.voiceSelect.value);
  updateKeyHint();
  els.settingsOverlay.hidden = true;
}
els.openSettings.addEventListener('click', openSettings);
els.closeSettings.addEventListener('click', closeSettings);
els.settingsOverlay.addEventListener('click', (e) => { if (e.target === els.settingsOverlay) closeSettings(); });
els.testVoice.addEventListener('click', () => {
  save(STORAGE.voice, els.voiceSelect.value);
  face.setExpression('happy');
  say('Hi! This is how I sound.', 'en-US');
});
els.clearKey.addEventListener('click', () => {
  localStorage.removeItem(STORAGE.key);
  els.apiKey.value = '';
  updateKeyHint();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !els.settingsOverlay.hidden) closeSettings(); });

// ---------- boot ----------
initLanguages();
initVoices();
initSettingsFields();
face.setExpression('happy');
