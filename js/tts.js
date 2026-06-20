// Text-to-speech wrapper.
//
// Default provider is the browser's built-in Web Speech API: it's free, needs
// no token, works on GitHub Pages immediately, and fires word-`boundary`
// events that are perfect for driving the face's lip-sync. The provider shape
// (`speak`/`cancel`/`listVoices`) is deliberately small so a network voice
// (ElevenLabs/OpenAI/OpenRouter) can be dropped in later without touching the
// rest of the app.

export class WebSpeechTTS {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.supported = !!this.synth;
    this.voices = [];
    if (this.supported) {
      this._loadVoices();
      this.synth.onvoiceschanged = () => this._loadVoices();
    }
  }

  _loadVoices() {
    this.voices = this.synth.getVoices();
  }

  listVoices() {
    if (!this.supported) return [];
    if (!this.voices.length) this._loadVoices();
    return this.voices;
  }

  // Pick the best available voice for a BCP-47 language tag, with optional
  // preferred voice name (exact match wins).
  pickVoice(lang, preferredName) {
    const voices = this.listVoices();
    if (!voices.length) return null;
    if (preferredName) {
      const exact = voices.find((v) => v.name === preferredName);
      if (exact) return exact;
    }
    if (lang) {
      const base = lang.toLowerCase().split('-')[0];
      const full = voices.find((v) => v.lang && v.lang.toLowerCase() === lang.toLowerCase());
      if (full) return full;
      const partial = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(base));
      if (partial) return partial;
    }
    return voices[0];
  }

  cancel() {
    if (this.supported) this.synth.cancel();
  }

  /**
   * Speak text. Returns a Promise that resolves when speech ends.
   * @param {string} text
   * @param {object} opts { lang, voiceName, rate, pitch, onStart, onBoundary, onEnd }
   */
  speak(text, opts = {}) {
    return new Promise((resolve) => {
      if (!this.supported || !text) { resolve(); return; }
      this.cancel();

      const u = new SpeechSynthesisUtterance(text);
      u.lang = opts.lang || 'en-US';
      u.rate = opts.rate ?? 0.98;
      u.pitch = opts.pitch ?? 1.05;
      const voice = this.pickVoice(u.lang, opts.voiceName);
      if (voice) u.voice = voice;

      let done = false;
      const finish = () => { if (done) return; done = true; opts.onEnd && opts.onEnd(); resolve(); };

      u.onstart = () => opts.onStart && opts.onStart();
      u.onboundary = (e) => opts.onBoundary && opts.onBoundary(e);
      u.onend = finish;
      u.onerror = finish;

      this.synth.speak(u);

      // Safety net: some engines never fire onend. Estimate a max duration.
      const est = Math.max(1500, (text.length / 12) * 1000 / (u.rate || 1)) + 1500;
      setTimeout(finish, est);
    });
  }
}
