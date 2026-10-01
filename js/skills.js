// ============================================================
// SKILLS.JS — skill generators, difficulty draw helpers, state, DOM refs
// ============================================================

// ---------- skill generators ----------
const SKILLS = {
  half: {
    label: 'Halving',
    gen(){
      const cfg = activeConfig('half');
      let min = Math.max(1, Math.min(cfg.min, cfg.max));
      let max = Math.max(cfg.min, cfg.max);
      const n = drawUnique('half', min, max, cfg.parity);
      return { text: `Half of ${n}`, answer: n/2 };
    }
  },
  x2: {
    label: '× 2',
    gen(){
      const cfg = activeConfig('x2');
      let min = Math.min(cfg.min, cfg.max), max = Math.max(cfg.min, cfg.max);
      const n = drawUnique('x2', min, max, cfg.parity);
      return { text: `${n} × 2`, answer: n*2 };
    }
  },
  x3: {
    label: '× 3',
    gen(){
      const cfg = activeConfig('x3');
      let min = Math.min(cfg.min, cfg.max), max = Math.max(cfg.min, cfg.max);
      const n = drawUnique('x3', min, max, cfg.parity);
      return { text: `${n} × 3`, answer: n*3 };
    }
  },
  add: {
    label: 'Additions',
    gen(){
      const cfg = activeConfig('add');
      let min = Math.min(cfg.min,cfg.max), max = Math.max(cfg.min,cfg.max);
      const count = cfg.count || 2;
      const nums = drawUniqueSet('add', min, max, cfg.parity, count);
      return { text: nums.join(' + '), answer: nums.reduce((a,b) => a+b, 0) };
    }
  }
};
const SKILL_ORDER = ['half','x2','x3','add'];


// ---------- state ----------
let state = {
  skill: null,
  totalQuestions: 15,
  currentIndex: 0,
  correctCount: 0,
  times: [],
  records: [],   // per-question detail: {skillKey, text, answer, given, correct, timeMs}
  currentProblem: null,
  currentSkillKey: null,
  questionStart: 0,
  perSkillTimer: null,
  timerDurationMs: 8000,
  streak: 0,
  running: false,       // true only while a round is actively in progress
  awaitingAdvance: false, // true briefly after an answer is locked in, before next question
  practiceMode: false,  // true = no timer, not counted in main stats
  seed: null,            // seed used for this round's question sequence
  fromChallenge: false   // true if this round was started by entering someone else's code
};

// ---------- elements ----------
const views = {
  home: document.getElementById('view-home'),
  play: document.getElementById('view-play'),
  results: document.getElementById('view-results'),
  history: document.getElementById('view-history'),
  historySkill: document.getElementById('view-history-skill'),
  historyFull: document.getElementById('view-history-full'),
  challenge: document.getElementById('view-challenge'),
  entercode: document.getElementById('view-entercode'),
  challengedetails: document.getElementById('view-challengedetails'),
};
function showView(name){
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[name].classList.add('active');
}

// NOTE: modeGrid/btnStart/durationToggle removed — Home no longer has a
// single Start button flow (Difficulty Picker owns skill+config+question
// count now, see js/ui.js). timerTrack/timerFill/problemText/answerInput/
// skillTag/metaProgress/metaAcc/metaAvg/correctReveal/correctRevealNum
// still point at the OLD Play view markup and will be rewired in Step 3b
// (Play + Results), not this step.
const timerTrack = document.getElementById('timerTrack');
const timerFill = document.getElementById('timerFill');
const problemText = document.getElementById('problemText');
const answerInput = document.getElementById('answerInput');
const skillTag = document.getElementById('skillTag');
const difficultyPill = document.getElementById('difficultyPill');
const metaProgress = document.getElementById('metaProgress');
const metaAcc = document.getElementById('metaAcc');
const metaAvg = document.getElementById('metaAvg');
const btnHistory = document.getElementById('btnHistory');
const btnChallengeCreate = document.getElementById('btnChallengeCreate');
const correctReveal = document.getElementById('correctReveal');
const correctRevealNum = document.getElementById('correctRevealNum');
const exitModal = document.getElementById('exitModal');
