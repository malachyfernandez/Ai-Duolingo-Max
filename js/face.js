// Expressive SVG tutor face.
// The face is built once, then animated by lerping a small set of numeric
// parameters toward a target "expression" every frame. The mouth is fully
// parametric so the same path drives both emotion (curve) and lip-sync (open).

const SVG = `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="tutor face">
  <defs>
    <radialGradient id="faceGrad" cx="50%" cy="36%" r="72%">
      <stop offset="0%" stop-color="#84e85a"/>
      <stop offset="100%" stop-color="#58cc02"/>
    </radialGradient>
  </defs>

  <!-- head tufts -->
  <path d="M70 26 Q86 -2 100 26 Q114 -2 130 26 Z" fill="#46a302"/>
  <!-- head -->
  <ellipse cx="100" cy="104" rx="84" ry="84" fill="url(#faceGrad)" stroke="#46a302" stroke-width="3"/>

  <!-- cheeks -->
  <ellipse id="cheekL" cx="60" cy="124" rx="13" ry="9" fill="#ff8fa3" opacity="0"/>
  <ellipse id="cheekR" cx="140" cy="124" rx="13" ry="9" fill="#ff8fa3" opacity="0"/>

  <!-- eyes -->
  <g id="eyeL">
    <ellipse cx="74" cy="94" rx="18" ry="20" fill="#ffffff" stroke="#46a302" stroke-width="2"/>
    <circle id="pupilL" cx="74" cy="94" r="8.5" fill="#3c3c3c"/>
    <circle id="shineL" cx="70.5" cy="90" r="2.6" fill="#ffffff"/>
  </g>
  <g id="eyeR">
    <ellipse cx="126" cy="94" rx="18" ry="20" fill="#ffffff" stroke="#46a302" stroke-width="2"/>
    <circle id="pupilR" cx="126" cy="94" r="8.5" fill="#3c3c3c"/>
    <circle id="shineR" cx="122.5" cy="90" r="2.6" fill="#ffffff"/>
  </g>

  <!-- eyebrows -->
  <rect id="browL" x="60" y="62" width="28" height="8" rx="4" fill="#2f7d12"/>
  <rect id="browR" x="112" y="62" width="28" height="8" rx="4" fill="#2f7d12"/>

  <!-- mouth -->
  <path id="mouth" d="" fill="#82323b" stroke="#5d2026" stroke-width="2" stroke-linejoin="round"/>
</svg>`;

export const EXPRESSIONS = {
  neutral:     { inner: 0,   browY: 0,  browAsym: 0, eyeOpen: 1.0,  gazeX: 0, gazeY: 0,  mouthW: 46, curve: 6,   open: 3,  blush: 0 },
  happy:       { inner: -4,  browY: -2, browAsym: 0, eyeOpen: 0.95, gazeX: 0, gazeY: 0,  mouthW: 52, curve: 18,  open: 6,  blush: 1 },
  excited:     { inner: -8,  browY: -6, browAsym: 0, eyeOpen: 1.12, gazeX: 0, gazeY: -1, mouthW: 50, curve: 18,  open: 15, blush: 1 },
  encouraging: { inner: -3,  browY: -1, browAsym: 0, eyeOpen: 1.0,  gazeX: 0, gazeY: 0,  mouthW: 50, curve: 13,  open: 5,  blush: 0 },
  sad:         { inner: -13, browY: 4,  browAsym: 0, eyeOpen: 0.82, gazeX: 0, gazeY: 3,  mouthW: 40, curve: -12, open: 2,  blush: 0 },
  angry:       { inner: 16,  browY: 4,  browAsym: 0, eyeOpen: 0.80, gazeX: 0, gazeY: 1,  mouthW: 40, curve: -8,  open: 3,  blush: 0 },
  surprised:   { inner: 0,   browY: -11,browAsym: 0, eyeOpen: 1.30, gazeX: 0, gazeY: 0,  mouthW: 30, curve: 0,   open: 20, blush: 0 },
  thinking:    { inner: 7,   browY: -2, browAsym: 8, eyeOpen: 0.92, gazeX: 5, gazeY: -4, mouthW: 28, curve: -3,  open: 2,  blush: 0 },
};

export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS);

function lerp(a, b, t) { return a + (b - a) * t; }

function mouthPath(cx, cy, w, curve, open) {
  const half = w / 2;
  const lx = cx - half, rx = cx + half;
  const cornerY = cy - curve;                 // smile lifts corners up
  const topCtrlY = cy - curve - open * 0.12;  // upper lip
  const botCtrlY = cy + open + curve * 0.15;  // lower lip drops as it opens
  return `M ${lx} ${cornerY} Q ${cx} ${topCtrlY} ${rx} ${cornerY} Q ${cx} ${botCtrlY} ${lx} ${cornerY} Z`;
}

export class Face {
  constructor(host) {
    host.innerHTML = SVG;
    this.el = {
      browL: host.querySelector('#browL'),
      browR: host.querySelector('#browR'),
      eyeL: host.querySelector('#eyeL'),
      eyeR: host.querySelector('#eyeR'),
      pupilL: host.querySelector('#pupilL'),
      pupilR: host.querySelector('#pupilR'),
      shineL: host.querySelector('#shineL'),
      shineR: host.querySelector('#shineR'),
      cheekL: host.querySelector('#cheekL'),
      cheekR: host.querySelector('#cheekR'),
      mouth: host.querySelector('#mouth'),
    };
    this.cur = { ...EXPRESSIONS.neutral };
    this.target = { ...EXPRESSIONS.neutral };
    this.talking = false;
    this.talkLevel = 0;
    this.blink = 0;          // 0 open, 1 closed
    this._blinkT = 0;
    this._scheduleBlink();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  setExpression(name) {
    const e = EXPRESSIONS[name] || EXPRESSIONS.neutral;
    this.target = { ...e };
    this.exprName = EXPRESSIONS[name] ? name : 'neutral';
  }

  talkStart() { this.talking = true; }
  talkStop() { this.talking = false; }
  // called on each spoken word boundary for a little emphasis
  nudge() { this.talkLevel = Math.max(this.talkLevel, 16); }

  _scheduleBlink() {
    this._nextBlink = performance.now() + 2200 + Math.random() * 3600;
  }

  _loop(now) {
    if (!this._last) this._last = now;
    const dt = Math.min(48, now - this._last);
    this._last = now;

    // ease current params toward target
    const k = 0.18;
    for (const key of Object.keys(this.target)) {
      this.cur[key] = lerp(this.cur[key], this.target[key], k);
    }

    // talking mouth motion
    if (this.talking) {
      const t = now * 0.001;
      const osc = (Math.sin(t * 22) * 0.5 + 0.5) * 7 + (Math.sin(t * 9.3) * 0.5 + 0.5) * 4 + Math.random() * 3;
      this.talkLevel = lerp(this.talkLevel, 3 + osc, 0.5);
    } else {
      this.talkLevel *= 0.6;
    }

    // blinking
    if (now >= this._nextBlink && this.blink === 0) this._blinkDir = 1;
    if (this._blinkDir === 1) {
      this.blink += dt / 70;
      if (this.blink >= 1) { this.blink = 1; this._blinkDir = -1; }
    } else if (this._blinkDir === -1) {
      this.blink -= dt / 90;
      if (this.blink <= 0) { this.blink = 0; this._blinkDir = 0; this._scheduleBlink(); }
    }

    this._render();
    requestAnimationFrame(this._loop);
  }

  _render() {
    const c = this.cur;

    // eyebrows: vertical shift + inner-end rotation (mirrored on right)
    this.el.browL.setAttribute('transform', `translate(0 ${c.browY}) rotate(${c.inner} 74 66)`);
    this.el.browR.setAttribute('transform', `translate(0 ${c.browY - c.browAsym}) rotate(${-c.inner} 126 66)`);

    // eyes: vertical squash for openness + blink, around each eye centre
    const sy = Math.max(0.06, c.eyeOpen * (1 - this.blink * 0.94));
    this.el.eyeL.setAttribute('transform', `translate(74 94) scale(1 ${sy}) translate(-74 -94)`);
    this.el.eyeR.setAttribute('transform', `translate(126 94) scale(1 ${sy}) translate(-126 -94)`);

    // pupils follow gaze
    this.el.pupilL.setAttribute('cx', 74 + c.gazeX); this.el.pupilL.setAttribute('cy', 94 + c.gazeY);
    this.el.pupilR.setAttribute('cx', 126 + c.gazeX); this.el.pupilR.setAttribute('cy', 94 + c.gazeY);
    this.el.shineL.setAttribute('cx', 70.5 + c.gazeX); this.el.shineL.setAttribute('cy', 90 + c.gazeY);
    this.el.shineR.setAttribute('cx', 122.5 + c.gazeX); this.el.shineR.setAttribute('cy', 90 + c.gazeY);

    // cheeks
    this.el.cheekL.setAttribute('opacity', c.blush * 0.85);
    this.el.cheekR.setAttribute('opacity', c.blush * 0.85);

    // mouth (emotion + lip-sync)
    const open = c.open + (this.talking ? this.talkLevel : this.talkLevel);
    this.el.mouth.setAttribute('d', mouthPath(100, 142, c.mouthW, c.curve, open));
  }
}
