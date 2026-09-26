// ============================================================
// GAME.JS — round logic, timer, input checking, results
// ============================================================

// ---------- exit-round flow ----------
const btnExitRound = document.getElementById('btnExitRound');
const btnCancelExit = document.getElementById('btnCancelExit');
const btnConfirmExit = document.getElementById('btnConfirmExit');

btnExitRound.addEventListener('click', () => {
  pauseRoundForModal();
  exitModal.classList.add('show');
});
btnCancelExit.addEventListener('click', () => {
  exitModal.classList.remove('show');
  resumeRoundAfterModal();
});
btnConfirmExit.addEventListener('click', () => {
  exitModal.classList.remove('show');
  endRoundAbruptly();
  showView('home');
});

function pauseRoundForModal(){
  if(state.perSkillTimer) clearTimeout(state.perSkillTimer);
  const computed = getComputedStyle(timerFill).transform;
  timerFill.style.transition = 'none';
  timerFill.style.transform = computed;
}
function resumeRoundAfterModal(){
  state.questionStart = performance.now();
  if(!state.practiceMode) runTimerBar();
  answerInput.focus();
}
function endRoundAbruptly(){
  state.running = false;
  if(state.perSkillTimer) clearTimeout(state.perSkillTimer);
  timerTrack.style.visibility = 'hidden';
  // TODO (Step 3b): topStreak pill removed from topbar — streak now belongs
  // in Play screen's own meta-chip row. Rewire when Play is redone.
  btnHistory.disabled = false;
}

// ---------- round logic ----------
function startRound(){
  state.currentIndex = 0;
  state.correctCount = 0;
  state.times = [];
  state.records = [];
  state.streak = 0;
  state.running = true;
  state.awaitingAdvance = false;

  if(pendingChallenge){
    // Starting from an entered challenge code: use its included skills, config, question
    // count and seed WITHOUT touching the player's own saved settings (skillConfig,
    // mixedIncluded) at all — those are restored automatically once the round ends.
    const ch = pendingChallenge;
    state.skill = ch.included.length > 1 ? 'mixed' : ch.included[0];
    state.totalQuestions = ch.n;
    activeChallengeCfg = ch.cfg;
    activeChallengeIncluded = ch.included;
    state.seed = ch.seed;
    state.fromChallenge = true;
    pendingChallenge = null;
  } else {
    activeChallengeCfg = null;
    activeChallengeIncluded = null;
    state.seed = randomSeed();
    state.fromChallenge = false;
  }
  rng = mulberry32(state.seed);

  resetUsedTracking(); // fresh no-repeat tracking per round

  // TODO (Step 3b): topStreak pill removed from topbar — rewire streak
  // display into Play screen's meta-chip row when Play is redone.
  timerTrack.style.visibility = state.practiceMode ? 'hidden' : 'visible';
  btnHistory.disabled = true;
  showView('play');
  nextQuestion();
}

function pickSkillKey(){
  if(activeChallengeIncluded){
    const pool = activeChallengeIncluded;
    // Single-skill challenges must NOT consume an rng() draw here — the sharer's own
    // original round never calls pickSkillKey() for a single-skill round (it returns
    // state.skill directly, below), so burning a draw for a 1-element pool would
    // desync the seeded sequence from question 1 onward for anyone entering the code.
    if(pool.length === 1) return pool[0];
    return pool[randInt(0, pool.length-1)];
  }
  if(state.skill === 'mixed'){
    const pool = includedSkillList();
    if(pool.length === 0) return SKILL_ORDER[randInt(0, SKILL_ORDER.length-1)]; // safety net, Start is blocked before this can happen
    return pool[randInt(0, pool.length-1)];
  }
  return state.skill;
}

function nextQuestion(){
  if(state.currentIndex >= state.totalQuestions){
    finishRound();
    return;
  }
  state.awaitingAdvance = false;
  const skillKey = pickSkillKey();
  state.currentSkillKey = skillKey;
  state.currentProblem = SKILLS[skillKey].gen();
  problemText.textContent = state.currentProblem.text;
  const skillLabelPart = state.skill === 'mixed' ? SKILLS[skillKey].label : '';
  skillTag.textContent = state.practiceMode
    ? (skillLabelPart ? skillLabelPart + ' · Practice' : 'Practice')
    : skillLabelPart;
  answerInput.value = '';
  answerInput.classList.remove('flash-good','flash-bad');
  problemText.classList.remove('shake');
  correctReveal.classList.remove('show');
  updateMeta();
  state.questionStart = performance.now();
  if(state.practiceMode){
    if(state.perSkillTimer) clearTimeout(state.perSkillTimer); // practice mode: no timer bar, no auto-fail
  } else {
    runTimerBar();
  }
  setTimeout(() => answerInput.focus(), 10);
}

function runTimerBar(){
  if(state.perSkillTimer) clearTimeout(state.perSkillTimer);
  timerFill.style.transition = 'none';
  timerFill.style.transform = 'scaleX(1)';
  timerFill.style.backgroundColor = 'var(--accent)';
  void timerFill.offsetWidth; // force reflow
  timerFill.style.transition = `transform ${state.timerDurationMs}ms linear, background-color .2s ease`;
  timerFill.style.transform = 'scaleX(0)';
  state.perSkillTimer = setTimeout(() => {
    if(!state.running || state.awaitingAdvance) return;
    lockInAnswer(null); // timeout = wrong, no answer given
  }, state.timerDurationMs);
}

// ---------- live-checking input ----------
answerInput.addEventListener('input', () => {
  if(!state.running || state.awaitingAdvance) return;
  const raw = answerInput.value.trim();
  if(raw === '' || raw === '-') return;
  const value = Number(raw);
  if(!Number.isNaN(value) && value === state.currentProblem.answer){
    lockInAnswer(value);
  }
});

// Enter still works as an explicit submit, useful to lock in a guess that doesn't match.
answerInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter'){
    if(state.awaitingAdvance) return;
    const raw = answerInput.value.trim();
    if(raw === '') return;
    lockInAnswer(Number(raw));
  }
});

function lockInAnswer(value){
  if(!state.running || state.awaitingAdvance) return;
  state.awaitingAdvance = true;
  if(state.perSkillTimer) clearTimeout(state.perSkillTimer);

  const elapsed = performance.now() - state.questionStart;
  const correct = value !== null && !Number.isNaN(value) && Number(value) === state.currentProblem.answer;

  state.times.push(elapsed);
  state.records.push({
    skillKey: state.currentSkillKey,
    text: state.currentProblem.text,
    answer: state.currentProblem.answer,
    given: (value === null || Number.isNaN(value)) ? null : value,
    correct: correct,
    timeMs: elapsed
  });
  if(correct){
    state.correctCount++;
    state.streak++;
    answerInput.classList.add('flash-good');
  } else {
    state.streak = 0;
    answerInput.classList.add('flash-bad');
    problemText.classList.add('shake');
    correctRevealNum.textContent = state.currentProblem.answer;
    correctReveal.classList.add('show');
  }
  // TODO (Step 3b): update streak display in Play's meta-chip row here
  state.currentIndex++;

  setTimeout(() => {
    if(!state.running) return; // user may have exited during the pause
    if(state.currentIndex >= state.totalQuestions){
      finishRound();
    } else {
      nextQuestion();
    }
  }, correct ? 260 : 900);
}

function updateMeta(){
  metaProgress.innerHTML = `<b>${state.currentIndex+1}</b> / ${state.totalQuestions}`;
  const attempted = state.currentIndex;
  const acc = attempted === 0 ? 100 : Math.round((state.correctCount/attempted)*100);
  metaAcc.innerHTML = `<b>${acc}%</b> accuracy`;
  const avg = attempted === 0 ? null : state.times.reduce((a,b)=>a+b,0)/attempted/1000;
  metaAvg.innerHTML = avg === null ? `<b>—</b> avg` : `<b>${avg.toFixed(1)}s</b> avg`;
}

function finishRound(){
  state.running = false;
  timerTrack.style.visibility = 'hidden';
  // TODO (Step 3b): topStreak pill removed from topbar — rewire streak
  // display into Play screen's meta-chip row when Play is redone.
  btnHistory.disabled = false;

  const accuracy = Math.round((state.correctCount/state.totalQuestions)*100);
  const avgTime = state.times.reduce((a,b)=>a+b,0)/state.times.length/1000;
  const bestTime = Math.min(...state.times)/1000;

  document.getElementById('resAcc').textContent = accuracy + '%';
  document.getElementById('resAvg').textContent = avgTime.toFixed(1) + 's';
  document.getElementById('resBest').textContent = bestTime.toFixed(1) + 's';
  document.getElementById('resultsTitle').textContent =
    accuracy === 100 ? 'Flawless round' : (accuracy >= 80 ? 'Solid round' : 'Round complete');

  renderResultsBreakdown();
  renderResultsConfigNote();

  const includedNow = activeIncludedList();
  const configSnapshot = state.skill === 'mixed'
    ? { cfg: includedNow.reduce((acc,k) => { acc[k] = JSON.parse(JSON.stringify(activeConfig(k))); return acc; }, {}), included: includedNow }
    : { cfg: JSON.parse(JSON.stringify(activeConfig(state.skill))) };

  const sessionRecord = {
    date: Date.now(),
    skill: state.skill,
    questions: state.totalQuestions,
    accuracy: accuracy,
    avgTime: avgTime,
    bestTime: bestTime,
    config: configSnapshot,
    fromChallenge: state.fromChallenge,
    practice: state.practiceMode
  };

  if(state.practiceMode){
    practiceSessions.push(sessionRecord);
    savePracticeSessions(practiceSessions);
  } else {
    sessions.push(sessionRecord);
    saveSessions(sessions);
  }

  showView('results');
}

function renderResultsBreakdown(){
  const records = state.records;

  // Slowest questions — top 5 by time, each row shows time + (if wrong) your answer vs correct
  const slowestList = document.getElementById('slowestList');
  slowestList.innerHTML = '';
  const bySlow = [...records].sort((a,b) => b.timeMs - a.timeMs).slice(0, 5);
  bySlow.forEach(r => {
    const row = document.createElement('div');
    row.className = 'detail-row' + (r.correct ? '' : ' miss');
    const givenStr = r.given === null ? 'no answer' : String(r.given);
    const answerPart = r.correct
      ? ''
      : `<span class="dr-wrong">${givenStr}</span> <span class="dr-correct">→ ${r.answer}</span>`;
    row.innerHTML = `
      <div class="dr-left">
        <span class="dr-problem">${r.text}</span>
        ${state.skill === 'mixed' ? `<span class="dr-skilltag">${skillDisplayLabels[r.skillKey]}</span>` : ''}
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        ${answerPart}
        <span class="dr-time" style="color:${r.correct ? 'var(--text)' : 'var(--bad)'}">${(r.timeMs/1000).toFixed(1)}s</span>
      </div>
    `;
    slowestList.appendChild(row);
  });

  // Per-skill breakdown (only relevant in mixed mode)
  const perSkillSection = document.getElementById('perSkillSection');
  const perSkillList = document.getElementById('perSkillList');
  perSkillList.innerHTML = '';
  if(state.skill === 'mixed'){
    perSkillSection.style.display = 'block';
    SKILL_ORDER.forEach(key => {
      const subset = records.filter(r => r.skillKey === key);
      if(subset.length === 0) return;
      const correctN = subset.filter(r => r.correct).length;
      const avg = subset.reduce((a,r)=>a+r.timeMs,0)/subset.length/1000;
      const row = document.createElement('div');
      row.className = 'skill-stat-row';
      row.innerHTML = `
        <span class="ssr-name">${skillDisplayLabels[key]}</span>
        <span class="ssr-nums">
          <span><b>${correctN}/${subset.length}</b> correct</span>
          <span><b>${avg.toFixed(1)}s</b> avg</span>
        </span>
      `;
      perSkillList.appendChild(row);
    });
  } else {
    perSkillSection.style.display = 'none';
  }

  // Missed questions — every wrong/timed-out answer, in order played
  const missedSection = document.getElementById('missedSection');
  const missedList = document.getElementById('missedList');
  missedList.innerHTML = '';
  const missed = records.filter(r => !r.correct);
  if(missed.length > 0){
    missedSection.style.display = 'block';
    missed.forEach(r => {
      const row = document.createElement('div');
      row.className = 'detail-row miss';
      const givenStr = r.given === null ? 'no answer' : String(r.given);
      row.innerHTML = `
        <div class="dr-left">
          <span class="dr-problem">${r.text}</span>
          ${state.skill === 'mixed' ? `<span class="dr-skilltag">${skillDisplayLabels[r.skillKey]}</span>` : ''}
        </div>
        <span>
          <span class="dr-wrong">${givenStr}</span> <span class="dr-correct">→ ${r.answer}</span>
        </span>
      `;
      missedList.appendChild(row);
    });
  } else {
    missedSection.style.display = 'none';
  }
}

const difficultyLabels = { veryeasy:'Very Easy', easy:'Easy', difficult:'Difficult', verydifficult:'Very Difficult', custom:'Custom' };

function describeSkillConfig(key, cfg){
  const diff = difficultyLabels[matchingDifficultyForConfig(key, cfg)];
  if(key === 'add'){
    return `${skillDisplayLabels[key]}: ${diff} (${cfg.min}–${cfg.max}, ${cfg.count || 2} numbers, ${cfg.parity})`;
  }
  return `${skillDisplayLabels[key]}: ${diff} (${cfg.min}–${cfg.max}, ${cfg.parity})`;
}

function renderResultsConfigNote(){
  const note = document.getElementById('resultsConfigNote');
  const parts = [];
  parts.push(`<b>${state.totalQuestions} questions</b>${state.practiceMode ? ' · practice mode' : ''}${state.fromChallenge ? ' · from a challenge code' : ''}`);
  if(state.skill === 'mixed'){
    const included = activeIncludedList();
    parts.push('Mix: ' + included.map(k => skillDisplayLabels[k]).join(', '));
    included.forEach(k => parts.push(describeSkillConfig(k, activeConfig(k))));
  } else {
    parts.push(describeSkillConfig(state.skill, activeConfig(state.skill)));
  }
  note.innerHTML = parts.join('<br>');
}
