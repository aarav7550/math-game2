// ============================================================
// UI.JS — home dashboard, difficulty picker, challenge create/enter screens
// ============================================================

// ---------- difficulty presets ----------
// Each preset fills range (+ count for additions); parity is left alone.
const DIFFICULTY_PRESETS = {
  half: {
    veryeasy: { min: 1, max: 99 },
    easy: { min: 100, max: 299 },
    difficult: { min: 100, max: 999 },
    verydifficult: { min: 1000, max: 9999 }
  },
  x2: {
    veryeasy: { min: 1, max: 20 },
    easy: { min: 20, max: 99 },
    difficult: { min: 100, max: 499 },
    verydifficult: { min: 500, max: 999 }
  },
  x3: {
    veryeasy: { min: 1, max: 15 },
    easy: { min: 15, max: 33 },
    difficult: { min: 34, max: 99 },
    verydifficult: { min: 100, max: 333 }
  },
  add: {
    veryeasy: { min: 1, max: 99, count: 2 },
    easy: { min: 1, max: 99, count: 3 },
    difficult: { min: 1, max: 999, count: 2 },
    verydifficult: { min: 1, max: 999, count: 3 }
  }
};
const skillDisplayLabels = { half:'Halving', x2:'× 2', x3:'× 3', add:'Additions' };

// ---------- more-options menu (About us / Report a bug) ----------
const btnMoreMenu = document.getElementById('btnMoreMenu');
const moreMenuDropdown = document.getElementById('moreMenuDropdown');
btnMoreMenu.addEventListener('click', (e) => {
  e.stopPropagation();
  moreMenuDropdown.classList.toggle('open');
});
document.addEventListener('click', () => moreMenuDropdown.classList.remove('open'));
// TODO (Step 6): btnAboutUs / btnReportBug currently have no destination —
// About us and Report a bug are static pages wired in Step 6.

// ---------- greeting + display name (mobile widget + desktop variant) ----------
const GREETING_MESSAGES = {
  morning:   ['Good morning', 'Rise and shine', 'Early bird'],
  afternoon: ['Good afternoon', 'Back for more', 'Ready to go fast'],
  evening:   ['Good evening', 'Evening warm-up', "Let's beat yesterday"],
  night:     ['Burning the midnight oil', 'Night owl', 'Still sharp']
};
function pickGreeting(){
  const h = new Date().getHours();
  const bucket = h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';
  const pool = GREETING_MESSAGES[bucket];
  return pool[Math.floor(Math.random() * pool.length)];
}
const greetingLine = pickGreeting(); // chosen once per page load

const PENCIL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const greetText = document.getElementById('greetText');
const greetName = document.getElementById('greetName');
const dgreetText = document.getElementById('dgreetText');
const dgreetName = document.getElementById('dgreetName');

function renderGreeting(){
  const name = getDisplayName();
  greetText.textContent = greetingLine;
  dgreetText.textContent = greetingLine;
  [ [greetName], [dgreetName] ].forEach(([el]) => {
    if(name){
      el.className = el === greetName ? 'greet-name' : 'dgreet-name';
      el.textContent = name;
      el.setAttribute('aria-label', 'Change your name, currently ' + name);
    } else {
      el.className = (el === greetName ? 'greet-name' : 'dgreet-name') + ' unset';
      el.innerHTML = 'set a name ' + PENCIL_SVG;
      el.setAttribute('aria-label', 'Set your name');
    }
  });
}
renderGreeting();

// As the page scrolls, the mobile greeting name shrinks down to the message's size.
(function(){
  if(window.matchMedia('(min-width:641px)').matches) return;
  const NAME_MAX = 30, NAME_MIN = 19, SHRINK_DISTANCE = 90;
  let ticking = false;
  function apply(){
    const y = Math.max(0, Math.min(window.scrollY, SHRINK_DISTANCE));
    const scale = 1 - (y / SHRINK_DISTANCE) * (1 - NAME_MIN / NAME_MAX);
    greetName.style.transform = 'scale(' + scale.toFixed(3) + ')';
    ticking = false;
  }
  apply();
  document.getElementById('view-home').addEventListener('scroll', () => {
    if(!ticking){ requestAnimationFrame(apply); ticking = true; }
  }, {passive:true});
})();

const nameOverlay = document.getElementById('nameOverlay');
const nameInput = document.getElementById('nameInput');
function openNameEditor(){
  nameInput.value = getDisplayName();
  nameOverlay.classList.add('show');
  setTimeout(() => { nameInput.focus(); nameInput.select(); }, 60);
}
function closeNameEditor(){ nameOverlay.classList.remove('show'); nameInput.blur(); }
function commitName(){
  setDisplayName(nameInput.value);
  renderGreeting();
  closeNameEditor();
}
greetName.addEventListener('click', openNameEditor);
dgreetName.addEventListener('click', openNameEditor);
document.getElementById('nameSave').addEventListener('click', commitName);
document.getElementById('nameCancel').addEventListener('click', closeNameEditor);
nameOverlay.addEventListener('click', (e) => { if(e.target === nameOverlay) closeNameEditor(); });
nameInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter'){ e.preventDefault(); commitName(); }
  else if(e.key === 'Escape'){ closeNameEditor(); }
});

// ---------- shared trend chart (Home card here; History page reuses in Step 4) ----------
// TODO (Step 4, per link-up-plan.md port-note): extract this into one js/trendchart.js
// shared by Home and History, instead of living inline in ui.js. Left inline for now
// since History hasn't been rewired yet — duplicating it there would mean fixing it twice.
const TrendChart = (function(){
  let seq = 0;
  const W = 640, H = 260, padL = 44, padR = 34, padT = 16, padB = 32;
  const WINDOW_DAYS = 30, LABELS = 6, DAY_MS = 86400000;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function dayStart(ts){ const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function labelFor(daysAgo, today){
    if(!daysAgo) return 'Today';
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
    return MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  function mount(container, sessionPoints){
    const today = dayStart(Date.now());
    const rows = (sessionPoints || []).map(s => ({
      daysAgo: Math.round((today - dayStart(s.ts)) / DAY_MS), val: s.val, acc: s.acc
    })).filter(r => r.daysAgo >= 0 && r.daysAgo <= WINDOW_DAYS)
      .sort((a,b) => b.daysAgo - a.daysAgo);

    if(!rows.length){
      container.innerHTML = '<div class="tc-empty">Play a round to start your trend</div>';
      return null;
    }

    const gid = 'tcFill' + (++seq);
    container.innerHTML =
      '<div class="trend-chart-wrap">'
      + '<div class="tc-head">'
      +   '<div class="tc-legend">'
      +     '<span class="leg-item"><span class="leg-dash leg-time"></span>Avg time</span>'
      +     '<span class="leg-item"><span class="leg-dash leg-acc"></span>Accuracy</span>'
      +   '</div>'
      + '</div>'
      + '<div class="chart-tooltip"><span class="ct-date"></span><span class="ct-val"></span></div>'
      + '<svg class="trend-svg" viewBox="0 0 640 260" preserveAspectRatio="none">'
      +   '<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1">'
      +     '<stop offset="0%" stop-color="#5FC2FC" stop-opacity="0.32"/>'
      +     '<stop offset="100%" stop-color="#5FC2FC" stop-opacity="0"/>'
      +   '</linearGradient></defs>'
      +   '<g class="tc-grid"></g>'
      +   '<path class="tc-area" fill="url(#'+gid+')"/>'
      +   '<path class="tc-line" fill="none" stroke="#5FC2FC" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
      +   '<path class="tc-accline" fill="none" stroke="#FF6B6B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>'
      +   '<g class="tc-points"></g>'
      +   '<g class="tc-axis"></g>'
      +   '<line class="chart-crosshair" x1="0" y1="0" x2="0" y2="228"/>'
      +   '<rect class="chart-hit-area" x="'+(padL-10)+'" y="0" width="'+(W-padL-padR+20)+'" height="260"/>'
      + '</svg>'
      + '</div>';

    const wrap = container.querySelector('.trend-chart-wrap');
    const svg = container.querySelector('.trend-svg');
    const gridLayer = svg.querySelector('.tc-grid');
    const axisLabels = svg.querySelector('.tc-axis');
    const pointsLayer = svg.querySelector('.tc-points');
    const plotW = W - padL - padR, plotH = H - padT - padB, plotR = padL + plotW;

    const vals = rows.map(r => r.val);
    let rawMin = Math.min.apply(null, vals), rawMax = Math.max.apply(null, vals);
    let span = rawMax - rawMin;
    if(span < 0.4) span = 0.4;
    const pad = span * 0.18;
    let yMin = Math.max(0, rawMin - pad), yMax = rawMax + pad;
    yMin = Math.floor(yMin * 2) / 2;
    yMax = Math.ceil(yMax * 2) / 2;
    if(yMax - yMin < 1) yMax = yMin + 1;
    const steps = 4, stepVal = (yMax - yMin) / steps;

    function xForDays(daysAgo){ return padL + ((WINDOW_DAYS - daysAgo) / WINDOW_DAYS) * plotW; }
    function xFor(i){ return xForDays(rows[i].daysAgo); }
    function yFor(v){ return padT + ((v - yMin) / (yMax - yMin)) * plotH; }
    function yForAcc(v){ return padT + (1 - v / 100) * plotH; }

    let gridHtml = '', labelHtml = '';
    for(let g = 0; g <= steps; g++){
      const gv = yMax - g * stepVal, gy = yFor(gv);
      gridHtml += '<line x1="'+padL+'" y1="'+gy+'" x2="'+plotR+'" y2="'+gy+'" stroke="rgba(255,255,255,0.12)" stroke-width="1" stroke-dasharray="2,4"/>';
      labelHtml += '<text class="chart-axis-label" x="0" y="'+(gy+5)+'" fill="#8FA3BD" font-family="Inter">'+gv.toFixed(1)+'s</text>';
    }

    let xLabelHtml = '';
    for(let k = 0; k < LABELS; k++){
      const d = WINDOW_DAYS - k * (WINDOW_DAYS / (LABELS - 1));
      const tx = xForDays(d);
      gridHtml += '<line x1="'+tx+'" y1="'+padT+'" x2="'+tx+'" y2="'+(H-padB+4)+'" stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="2,4"/>';
      xLabelHtml += '<text class="chart-axis-label" x="'+tx+'" y="'+(H-8)+'" fill="#8FA3BD" font-family="Inter" text-anchor="middle">'+labelFor(d, today)+'</text>';
    }
    gridLayer.innerHTML = gridHtml;
    axisLabels.innerHTML = labelHtml + xLabelHtml;

    const lastIdx = rows.length - 1;
    const linePts = rows.map((r,i) => xFor(i)+','+yFor(r.val));
    svg.querySelector('.tc-line').setAttribute('d', 'M'+linePts.join(' L'));
    svg.querySelector('.tc-area').setAttribute('d',
      'M'+linePts.join(' L')+' L'+xFor(lastIdx)+','+(H-padB)+' L'+xFor(0)+','+(H-padB)+' Z');
    const accPts = rows.map((r,i) => xFor(i)+','+yForAcc(r.acc));
    svg.querySelector('.tc-accline').setAttribute('d', 'M'+accPts.join(' L'));

    let ptsHtml = '';
    rows.forEach((r,i) => {
      const x = xFor(i), y = yFor(r.val), ay = yForAcc(r.acc);
      const isLast = i === lastIdx, rad = isLast ? 5 : 4, accRad = isLast ? 5 : 3;
      ptsHtml += '<g class="pt">'
        + '<circle cx="'+x+'" cy="'+y+'" r="16" fill="transparent"/>'
        + '<circle cx="'+x+'" cy="'+y+'" r="'+rad+'" fill="'+(isLast?'#5FC2FC':'#09152b')+'" stroke="#5FC2FC" stroke-width="2" class="pt-dot"/>'
        + '<circle cx="'+x+'" cy="'+ay+'" r="'+accRad+'" fill="'+(isLast?'#FF6B6B':'#09152b')+'" stroke="#FF6B6B" stroke-width="1.5" class="pt-dot-acc"/>'
        + '</g>';
    });
    pointsLayer.innerHTML = ptsHtml;

    const pts = rows.map((r,i) => ({ x: xFor(i), label: labelFor(r.daysAgo, today), val: r.val, acc: r.acc }));

    const tooltip = container.querySelector('.chart-tooltip');
    const ctDate = tooltip.querySelector('.ct-date'), ctVal = tooltip.querySelector('.ct-val');
    const crosshair = svg.querySelector('.chart-crosshair'), hitArea = svg.querySelector('.chart-hit-area');
    const points = svg.querySelectorAll('.pt');
    const BLUE_GLOW = 'drop-shadow(0 0 4px #5FC2FC)';
    const RED_GLOW = 'drop-shadow(0 0 4px #FF6B6B) drop-shadow(0 0 2px #FF6B6B)';

    function nearestIdx(svgX){
      let best = 0, bestDist = Infinity;
      for(let i = 0; i < pts.length; i++){
        const dd = Math.abs(pts[i].x - svgX);
        if(dd < bestDist){ bestDist = dd; best = i; }
      }
      return best;
    }
    function clearGlow(){
      points.forEach(pn => {
        pn.querySelector('.pt-dot').style.filter = 'none';
        pn.querySelector('.pt-dot-acc').style.filter = 'none';
      });
    }
    function showAt(i){
      const p = pts[i], r = svg.getBoundingClientRect();
      ctDate.textContent = p.label;
      ctVal.textContent = p.val.toFixed(1)+'s avg · '+p.acc+'% acc';
      tooltip.classList.add('show');
      const w = tooltip.offsetWidth, wrapW = wrap.clientWidth;
      const cx = p.x * (r.width / 640);
      tooltip.style.left = Math.min(Math.max(cx, w/2), wrapW - w/2) + 'px';
      crosshair.setAttribute('x1', p.x); crosshair.setAttribute('x2', p.x);
      crosshair.classList.add('show');
      clearGlow();
      points[i].querySelector('.pt-dot').style.filter = BLUE_GLOW;
      points[i].querySelector('.pt-dot-acc').style.filter = RED_GLOW;
    }
    function hide(){ tooltip.classList.remove('show'); crosshair.classList.remove('show'); clearGlow(); }
    function handlePointer(clientX){
      const r = svg.getBoundingClientRect();
      showAt(nearestIdx(((clientX - r.left) / r.width) * 640));
    }
    hitArea.addEventListener('mousemove', (e) => handlePointer(e.clientX));
    hitArea.addEventListener('mouseleave', hide);
    hitArea.addEventListener('touchstart', (e) => { e.preventDefault(); handlePointer(e.touches[0].clientX); }, {passive:false});
    hitArea.addEventListener('touchmove', (e) => { e.preventDefault(); handlePointer(e.touches[0].clientX); }, {passive:false});
    document.addEventListener('touchstart', (e) => { if(!wrap.contains(e.target)) hide(); }, {passive:true});
    document.addEventListener('click', (e) => { if(!wrap.contains(e.target)) hide(); });

    return { pts: pts };
  }
  return { mount: mount };
})();

// ---------- dashboard rendering (real data — sessions + skillConfig) ----------
const SKILL_ICON = { half:'÷2', x2:'×2', x3:'×3', add:'+' };
const SKILL_CLASS = { half:'c-half', x2:'c-x2', x3:'c-x3', add:'c-add' };
const SKILL_DESC = { half:'Split a number in two', x2:'Double it', x3:'Triple it', add:'Add several numbers together' };
const SKILL_COLOR = { half:'#3B6FE0', x2:'#1F9D6C', x3:'#DB8B1E', add:'#A6459B' };

function renderDashboardStats(){
  const streak = getCurrentStreak();
  document.getElementById('streakNum').textContent = streak > 0 ? (streak + ' 🔥') : String(streak);

  document.getElementById('statToday').textContent = String(getTodayQuestionCount());

  const sevenDayAcc = getSevenDayAccuracy();
  document.getElementById('stat7dAcc').textContent = sevenDayAcc === null ? '—' : sevenDayAcc + '%';
  document.getElementById('stat7dSub').textContent = sevenDayAcc === null ? 'no rounds yet' : 'last 7 days';

  const last = getLastSession();
  document.getElementById('statLastAvg').textContent = last ? last.avgTime.toFixed(1) + 's' : '—';
  document.getElementById('statLastAcc').textContent = last ? last.accuracy + '% accuracy' : 'no rounds yet';

  // History card (top-of-dashboard trend + overall avg/acc)
  const hcTitle = document.getElementById('hcTitle');
  const overallAvgEl = document.getElementById('hcOverallAvg');
  const overallAccEl = document.getElementById('hcOverallAcc');
  if(sessions.length === 0){
    hcTitle.textContent = 'Getting started';
    overallAvgEl.textContent = '—';
    overallAccEl.textContent = '—';
  } else {
    hcTitle.textContent = 'Your progress';
    const overallAvg = sessions.reduce((a,s) => a+s.avgTime, 0) / sessions.length;
    const overallAcc = Math.round(sessions.reduce((a,s) => a+s.accuracy, 0) / sessions.length);
    overallAvgEl.textContent = overallAvg.toFixed(1) + 's';
    overallAccEl.textContent = overallAcc + '%';
  }
  const trendPoints = sessions.map(s => ({ ts: s.date, val: s.avgTime, acc: s.accuracy }));
  TrendChart.mount(document.getElementById('homeTrend'), trendPoints);

  // Feeling brave strip stats — best avg + overall accuracy across mixed-mode rounds only
  const mixedSessions = sessions.filter(s => s.skill === 'mixed');
  const bsAvg = document.getElementById('bsAvg');
  const bsAcc = document.getElementById('bsAcc');
  if(mixedSessions.length === 0){
    bsAvg.textContent = '—';
    bsAcc.textContent = '—';
  } else {
    bsAvg.textContent = Math.min(...mixedSessions.map(s => s.avgTime)).toFixed(1) + 's';
    bsAcc.textContent = Math.round(mixedSessions.reduce((a,s) => a+s.accuracy, 0) / mixedSessions.length) + '%';
  }
}

function renderSkillCards(){
  const grid = document.getElementById('skillGrid');
  grid.innerHTML = '';
  SKILL_ORDER.forEach(key => {
    const skillSessions = sessions.filter(s => s.skill === key);
    const hasData = skillSessions.length > 0;
    const avg = hasData ? skillSessions.reduce((a,s) => a+s.avgTime, 0) / skillSessions.length : null;
    const acc = hasData ? Math.round(skillSessions.reduce((a,s) => a+s.accuracy, 0) / skillSessions.length) : null;
    // progress bar: how close recent accuracy is to 100%, just a simple visual — not a claim of mastery
    const progressPct = hasData ? Math.max(4, Math.min(100, acc)) : 0;

    const card = document.createElement('button');
    card.className = 'skill-card ' + SKILL_CLASS[key];
    card.dataset.skill = key;
    card.innerHTML = `
      <div class="sk-top">
        <div class="sk-icon">${SKILL_ICON[key]}</div>
        <div>
          <div class="sk-name">${skillDisplayLabels[key]}</div>
          <div class="sk-desc">${SKILL_DESC[key]}</div>
        </div>
      </div>
      <div class="sk-progress-track"><div class="sk-progress-fill" style="width:${progressPct}%"></div></div>
      <div class="sk-nums">
        <div class="sk-stat"><div class="num">${hasData ? avg.toFixed(1)+'s' : '—'}</div><div class="lbl">Avg</div></div>
        <div class="sk-stat"><div class="num">${hasData ? acc+'%' : '—'}</div><div class="lbl">Accuracy</div></div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderHomeDashboard(){
  renderDashboardStats();
  renderSkillCards();
}
renderHomeDashboard();

document.getElementById('skillGrid').addEventListener('click', (e) => {
  const card = e.target.closest('.skill-card');
  if(!card || card.classList.contains('soon')) return;
  openDifficultyPicker(card.dataset.skill);
});

document.getElementById('historyCard').addEventListener('click', () => {
  renderHistory();
  showView('history');
});

// Mixed drill strip: deliberately a no-op for now (see math-game project notes) —
// Mixed needs an Include tab + per-skill config the Difficulty Picker mockup doesn't
// have yet. Wired in a later step.
document.getElementById('btnMixedStart').addEventListener('click', () => {});

// ---------- Difficulty Picker ----------
const DIFF_LABELS = { veryeasy:'Very Easy', easy:'Easy', difficult:'Difficult', verydifficult:'Very Difficult', custom:'Custom' };
const CUSTOM_NOTE = {
  half: 'Pick your own min/max and number type before you start.',
  x2: 'Pick your own min/max before you start.',
  x3: 'Pick your own min/max before you start.',
  add: 'Pick your own min/max and how many numbers to add.'
};
const LEVEL_READY_MESSAGE = {
  veryeasy: 'Easing in, nice and steady.',
  easy: "You've got this.",
  difficult: 'Feeling brave?',
  verydifficult: "Don't say we didn't warn you.",
  custom: 'Going off script?'
};

let CURRENT_SKILL = null;
let pickerLevel = null; // 'veryeasy'|'easy'|'difficult'|'verydifficult'|'custom'|null — reset each open
let pickerCustom = null; // deep copy of this skill's config, edited live if level === 'custom'
let selectedQuestionCount = 15;

const diffModalOverlay = document.getElementById('diffModalOverlay');
const diffModal = document.getElementById('diffModal');
const dmIcon = document.getElementById('dmIcon');
const dmSkillname = document.getElementById('dmSkillname');
const diffCardMount = document.getElementById('diffCardMount');
const dssSub = document.getElementById('dssSub');
const btnStartRound = document.getElementById('btnStartRound');
const qcountBar = document.getElementById('qcountBar');
const qcountCustomBtn = document.getElementById('qcountCustomBtn');
const qcountInlineValue = document.getElementById('qcountInlineValue');

// Range label shown on each preset pill, built from the real DIFFICULTY_PRESETS.
function presetLabel(skillKey, level){
  const p = DIFFICULTY_PRESETS[skillKey][level];
  if(skillKey === 'add') return `${p.min}–${p.max}, ${p.count} numbers`;
  return `${p.min}–${p.max}`;
}
// Real presets carry no explanatory note text (that was mockup-only flavor) — build a
// plain factual one from the actual numbers instead of inventing copy that might mislead.
function presetNote(skillKey, level){
  const p = DIFFICULTY_PRESETS[skillKey][level];
  if(skillKey === 'add') return `Add <b>${p.count} numbers</b> from ${p.min}–${p.max}.`;
  return `Numbers from <b>${p.min}–${p.max}</b>.`;
}

function buildConfigCard(skillKey){
  const isAdd = skillKey === 'add';
  const isCustom = pickerLevel === 'custom';

  const pillHtml = (level) => `
    <button class="diff-opt ${pickerLevel===level?'active':''}" data-level="${level}">
      <div class="do-name">${DIFF_LABELS[level]}</div>
      <div class="do-range">${presetLabel(skillKey, level)}</div>
      <span class="info-btn" onclick="event.stopPropagation(); toggleNote(this)">
        <span class="info-dot">i</span>
        <span class="info-note"><span class="in-arrow"></span>${presetNote(skillKey, level)}</span>
      </span>
    </button>`;

  let customRowsHtml = `
    <div class="config-row">
      <label>Range</label>
      <div class="range-inputs">
        <input type="number" class="range-input" data-field="min" value="${pickerCustom.min}">
        <span class="dim">–</span>
        <input type="number" class="range-input" data-field="max" value="${pickerCustom.max}">
      </div>
    </div>`;

  if(!isAdd){
    customRowsHtml += `
    <div class="config-row">
      <label>Type</label>
      <div class="segmented" data-seg="parity">
        <button data-v="any" class="${pickerCustom.parity==='any'?'active':''}">Any</button>
        <button data-v="even" class="${pickerCustom.parity==='even'?'active':''}">Even</button>
        <button data-v="odd" class="${pickerCustom.parity==='odd'?'active':''}">Odd</button>
      </div>
    </div>`;
  }

  if(isAdd){
    const count = pickerCustom.count || 2;
    const countIsCustomVal = ![2,3,4].includes(count);
    customRowsHtml += `
    <div class="config-row">
      <label>How many</label>
      <div class="segmented count-seg" data-seg="count">
        <button data-v="2" class="${count===2?'active':''}">2</button>
        <button data-v="3" class="${count===3?'active':''}">3</button>
        <button data-v="4" class="${count===4?'active':''}">4</button>
        <button data-v="custom" class="count-custom-btn ${countIsCustomVal?'active editing':''}" title="Custom count" aria-label="Custom count">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          <input type="number" class="count-custom-input" min="1" style="display:${countIsCustomVal?'block':'none'};" value="${countIsCustomVal ? count : ''}">
        </button>
      </div>
    </div>`;
  }

  const card = document.createElement('div');
  card.className = 'diff-card';
  card.dataset.skill = skillKey;
  card.innerHTML = `
    <div class="diff-rows">
      <div class="diff-row pair">${pillHtml('veryeasy')}${pillHtml('easy')}</div>
      <div class="diff-row pair">${pillHtml('difficult')}${pillHtml('verydifficult')}</div>
      <div class="diff-row single">
        <button class="diff-opt ${isCustom?'active':''}" data-level="custom">
          <div class="do-name">Custom</div>
          <div class="do-range">Set your own</div>
          <span class="info-btn" onclick="event.stopPropagation(); toggleNote(this)">
            <span class="info-dot">i</span>
            <span class="info-note"><span class="in-arrow"></span>${CUSTOM_NOTE[skillKey]}</span>
          </span>
        </button>
      </div>
    </div>
    <div class="custom-editor ${isCustom?'show':''}">
      <div class="config-rows">${customRowsHtml}</div>
      <div class="ce-error" id="ceError">Enter a valid min and max (min below max).</div>
    </div>
  `;
  return card;
}

function refreshCard(){
  diffCardMount.innerHTML = '';
  diffCardMount.appendChild(buildConfigCard(CURRENT_SKILL));
}

function isSelectionReady(){
  if(!pickerLevel) return false;
  if(pickerLevel === 'custom'){
    const min = parseInt(pickerCustom.min, 10);
    const max = parseInt(pickerCustom.max, 10);
    return Number.isFinite(min) && Number.isFinite(max) && min < max;
  }
  return true;
}

function updateStartStrip(){
  const ready = isSelectionReady();
  btnStartRound.disabled = !ready;
  if(!pickerLevel){
    dssSub.textContent = 'Pick a difficulty above to begin';
  } else if(pickerLevel === 'custom'){
    dssSub.textContent = ready ? LEVEL_READY_MESSAGE.custom : 'Enter a valid min and max above';
  } else {
    dssSub.textContent = LEVEL_READY_MESSAGE[pickerLevel];
  }
}

function openDifficultyPicker(skillKey){
  CURRENT_SKILL = skillKey;
  pickerLevel = null; // deliberate: opening never pre-selects a level
  pickerCustom = Object.assign({}, skillConfig[skillKey]); // start custom editor from saved config
  selectedQuestionCount = 15;

  diffModal.style.setProperty('--sc', SKILL_COLOR[skillKey]);
  dmIcon.textContent = SKILL_ICON[skillKey];
  dmIcon.style.background = `color-mix(in srgb, ${SKILL_COLOR[skillKey]} 14%, #fff)`;
  dmIcon.style.color = SKILL_COLOR[skillKey];
  dmSkillname.textContent = skillDisplayLabels[skillKey];

  refreshCard();
  updateStartStrip();

  [...qcountBar.querySelectorAll('.qcount-opt')].forEach(o => o.classList.remove('active','expanded'));
  qcountBar.classList.remove('custom-active');
  qcountBar.querySelector('[data-n="15"]').classList.add('active');

  diffModalOverlay.classList.add('show');
}

function closeDifficultyPicker(){
  diffModalOverlay.classList.remove('show');
}
document.getElementById('btnDiffClose').addEventListener('click', closeDifficultyPicker);
diffModalOverlay.addEventListener('click', (e) => { if(e.target === diffModalOverlay) closeDifficultyPicker(); });

diffCardMount.addEventListener('click', (e) => {
  const diffOpt = e.target.closest('.diff-opt');
  if(diffOpt){
    const level = diffOpt.dataset.level;
    if(level === 'custom'){
      pickerLevel = (pickerLevel === 'custom') ? null : 'custom';
      refreshCard();
      updateStartStrip();
      return;
    }
    pickerLevel = level;
    refreshCard();
    updateStartStrip();
    return;
  }

  const parityBtn = e.target.closest('[data-seg="parity"] button');
  if(parityBtn){
    const seg = parityBtn.closest('[data-seg="parity"]');
    seg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    parityBtn.classList.add('active');
    pickerCustom.parity = parityBtn.dataset.v;
    return;
  }

  const countBtn = e.target.closest('[data-seg="count"] button');
  if(countBtn){
    const seg = countBtn.closest('[data-seg="count"]');
    if(countBtn.classList.contains('count-custom-btn')){
      const input = countBtn.querySelector('.count-custom-input');
      if(countBtn.classList.contains('editing')){
        input.focus();
        return;
      }
      seg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      countBtn.classList.add('active', 'editing');
      input.style.display = 'block';
      input.value = '';
      input.focus();
      input.select();
      return;
    }
    seg.querySelectorAll('button').forEach(b => {
      b.classList.remove('active');
      if(b.classList.contains('count-custom-btn')){
        b.classList.remove('editing');
        b.querySelector('.count-custom-input').style.display = 'none';
      }
    });
    countBtn.classList.add('active');
    pickerCustom.count = parseInt(countBtn.dataset.v, 10);
    return;
  }

  const countInput = e.target.closest('.count-custom-input');
  if(countInput){ e.stopPropagation(); return; }
});

diffCardMount.addEventListener('input', (e) => {
  const rangeInput = e.target.closest('.range-input');
  if(rangeInput){
    const field = rangeInput.dataset.field;
    const val = parseInt(rangeInput.value, 10);
    if(!Number.isNaN(val)) pickerCustom[field] = val;
    updateStartStrip();
    return;
  }
  const countInput = e.target.closest('.count-custom-input');
  if(countInput){
    const v = parseInt(countInput.value, 10);
    if(v > 0) pickerCustom.count = v;
    return;
  }
});

// ---------- question count bar ----------
qcountBar.querySelectorAll('.qcount-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    if(opt === qcountCustomBtn){
      qcountBar.querySelectorAll('.qcount-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active', 'expanded');
      qcountBar.classList.add('custom-active');
      qcountInlineValue.focus();
      if(qcountInlineValue.value){
        selectedQuestionCount = parseInt(qcountInlineValue.value, 10) || selectedQuestionCount;
      }
      return;
    }
    qcountBar.querySelectorAll('.qcount-opt').forEach(o => o.classList.remove('active'));
    qcountCustomBtn.classList.remove('expanded');
    qcountBar.classList.remove('custom-active');
    opt.classList.add('active');
    selectedQuestionCount = parseInt(opt.dataset.n, 10);
  });
});
qcountInlineValue.addEventListener('click', (e) => e.stopPropagation());
qcountInlineValue.addEventListener('input', () => {
  const v = parseInt(qcountInlineValue.value, 10);
  if(v > 0) selectedQuestionCount = v;
});

// ---------- info-note popovers (clamped to modal bounds) ----------
const MODAL_MARGIN = 10;
function positionNote(btn){
  const note = btn.querySelector('.info-note');
  const arrow = note.querySelector('.in-arrow');
  const btnRect = btn.getBoundingClientRect();
  const modalRect = diffModal.getBoundingClientRect();
  const noteWidth = note.offsetWidth || 210;
  let left = btnRect.left + (btnRect.width / 2) - (noteWidth / 2);
  const top = btnRect.bottom + 8;
  const minLeft = modalRect.left + MODAL_MARGIN;
  const maxLeft = modalRect.right - MODAL_MARGIN - noteWidth;
  left = Math.max(minLeft, Math.min(left, maxLeft));
  note.style.left = left + 'px';
  note.style.top = top + 'px';
  const arrowLeft = (btnRect.left + btnRect.width / 2) - left;
  arrow.style.left = arrowLeft + 'px';
  arrow.style.marginLeft = '-5px';
}
function toggleNote(btn){
  const note = btn.querySelector('.info-note');
  const wasOpen = note.classList.contains('open');
  document.querySelectorAll('.info-note.open').forEach(n => n.classList.remove('open'));
  if(!wasOpen){
    positionNote(btn);
    note.classList.add('open');
  }
}
window.toggleNote = toggleNote;
document.addEventListener('mouseover', (e) => {
  const btn = e.target.closest('.info-btn');
  if(btn) positionNote(btn);
});
window.addEventListener('resize', () => {
  document.querySelectorAll('.info-note.open').forEach(n => positionNote(n.closest('.info-btn')));
});
document.addEventListener('click', (e) => {
  if(!e.target.closest('.info-btn')){
    document.querySelectorAll('.info-note.open').forEach(n => n.classList.remove('open'));
  }
});

// Bring focused number fields into view above the mobile keyboard — modal itself scrolls
// (it has overflow-y:auto), not the window.
document.addEventListener('focusin', (e) => {
  const field = e.target;
  if(!field.matches('input[type="number"], input[type="text"]')) return;
  setTimeout(() => {
    const modalRect = diffModal.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();
    const targetY = modalRect.top + (modalRect.height * 0.4);
    const delta = fieldRect.top - targetY;
    diffModal.scrollBy({ top: delta, behavior: 'smooth' });
  }, 200);
});

// ---------- Start round: commits picker's choice into real skillConfig, then plays ----------
btnStartRound.addEventListener('click', () => {
  if(!isSelectionReady()) return;
  const key = CURRENT_SKILL;

  if(pickerLevel === 'custom'){
    skillConfig[key] = Object.assign({}, skillConfig[key], pickerCustom);
  } else {
    const preset = DIFFICULTY_PRESETS[key][pickerLevel];
    skillConfig[key].min = preset.min;
    skillConfig[key].max = preset.max;
    if(key === 'add' && preset.count) skillConfig[key].count = preset.count;
  }
  saveConfig();

  state.skill = key;
  state.totalQuestions = selectedQuestionCount;
  state.practiceMode = false;

  closeDifficultyPicker();
  startRound();
});

// ---------- session labeling helper (used by history.js/game.js) ----------

// Used by history.js/game.js to label past sessions against the real presets above.
function matchingDifficultyForConfig(key, cfg){
  const presets = DIFFICULTY_PRESETS[key];
  if(!presets || !cfg) return 'custom';
  const matches = (preset) => {
    if(cfg.min !== preset.min || cfg.max !== preset.max) return false;
    if(key === 'add' && (cfg.count || 2) !== (preset.count || 2)) return false;
    return true;
  };
  for(const diffKey of Object.keys(presets)){
    if(matches(presets[diffKey])) return diffKey;
  }
  return 'custom';
}
function matchingDifficulty(key){
  return matchingDifficultyForConfig(key, skillConfig[key]);
}

document.getElementById('btnHome').addEventListener('click', () => showView('home'));
document.getElementById('btnShareSet').addEventListener('click', () => {
  // Reuses the exact seed from the round just played, so a "hard set" reproduces
  // literally — not just the same config with a fresh set of numbers.
  // Must reflect the skill(s) actually played in THIS round, not the live Mixed-mode
  // toggle state — activeIncludedList() falls back to includedSkillList() (the saved
  // mixed toggles) whenever this round wasn't itself started from a challenge code,
  // which is exactly the case for a normal single-skill round like halving.
  const included = activeChallengeIncluded
    ? activeChallengeIncluded
    : (state.skill === 'mixed' ? includedSkillList() : [state.skill]);
  if(included.length === 0) return;
  const cfgBySkill = {};
  included.forEach(k => cfgBySkill[k] = activeConfig(k));
  const payload = buildChallengePayload(included, cfgBySkill, state.totalQuestions, state.seed);
  showGeneratedCode(encodeChallengeCode(payload));
});
document.getElementById('btnBackHome').addEventListener('click', () => showView('home'));

// NOTE: Practice mode has no UI in the new Home/Difficulty Picker mockups yet
// (flagged gap - old Home had a checkbox for it, not carried into the redesign).
// Stubbed so existing state.practiceMode reads/writes elsewhere don't throw until
// a real place for it is designed.
const practiceCheckbox = { checked: false };

// ---------- challenge codes: create (dedicated screen) ----------
const challengeShowModal = document.getElementById('challengeShowModal');
const challengeCodeText = document.getElementById('challengeCodeText');
const challengeSkillsList = document.getElementById('challengeSkillsList');
const challengeSkillConfigs = document.getElementById('challengeSkillConfigs');
const challengeDurationToggle = document.getElementById('challengeDurationToggle');
const btnChallengeGenerate = document.getElementById('btnChallengeGenerate');
const challengeCreateBlockedMsg = document.getElementById('challengeCreateBlockedMsg');

// Independent draft state for the challenge screen — starts from the user's own saved
// config as a convenient default, but editing it here never touches skillConfig/mixedIncluded.
let challengeDraftIncluded = null;
let challengeDraftConfig = null;
let challengeDraftQuestions = 15;

function openChallengeScreen(){
  challengeDraftIncluded = Object.assign({}, mixedIncluded);
  challengeDraftConfig = JSON.parse(JSON.stringify(skillConfig));
  challengeDraftQuestions = state.totalQuestions || 15;
  renderChallengeSkillsList();
  renderChallengeSkillConfigs();
  [...challengeDurationToggle.children].forEach(b => b.classList.toggle('active', parseInt(b.dataset.n,10) === challengeDraftQuestions));
  refreshChallengeGenerateEligibility();
  showView('challenge');
}

function refreshChallengeGenerateEligibility(){
  const anyIncluded = SKILL_ORDER.some(k => challengeDraftIncluded[k]);
  btnChallengeGenerate.disabled = !anyIncluded;
  challengeCreateBlockedMsg.style.display = anyIncluded ? 'none' : 'block';
}

function renderChallengeSkillsList(){
  challengeSkillsList.innerHTML = '';
  SKILL_ORDER.forEach(key => {
    const row = document.createElement('button');
    row.className = 'include-toggle-row' + (challengeDraftIncluded[key] ? ' active' : '');
    row.dataset.skill = key;
    row.innerHTML = `
      <span>${skillDisplayLabels[key]}</span>
      <span class="include-check">${challengeDraftIncluded[key] ? '✓' : ''}</span>
    `;
    challengeSkillsList.appendChild(row);
  });
}
challengeSkillsList.addEventListener('click', (e) => {
  const row = e.target.closest('.include-toggle-row');
  if(!row) return;
  const key = row.dataset.skill;
  challengeDraftIncluded[key] = !challengeDraftIncluded[key];
  renderChallengeSkillsList();
  renderChallengeSkillConfigs();
  refreshChallengeGenerateEligibility();
});

// Builds one config card per currently-included skill, each with its own range/parity
// inputs — all visible at once, nothing tabbed or hidden.
function renderChallengeSkillConfigs(){
  challengeSkillConfigs.innerHTML = '';
  const includedKeys = SKILL_ORDER.filter(k => challengeDraftIncluded[k]);
  if(includedKeys.length === 0){
    challengeSkillConfigs.innerHTML = '<div class="challenge-empty-note">Select a skill on the left to configure it.</div>';
    return;
  }
  includedKeys.forEach(key => {
    const cfg = challengeDraftConfig[key];
    const card = document.createElement('div');
    card.className = 'challenge-skill-config';
    card.dataset.skill = key;

    const isAdd = key === 'add';
    const presets = DIFFICULTY_PRESETS[key];
    card.innerHTML = `
      <div class="csc-title">${skillDisplayLabels[key]}</div>
      <div class="csc-rows">
        <div class="settings-row">
          <label>Difficulty</label>
          <div class="segmented cc-difficulty">
            <button data-v="veryeasy">Very Easy</button>
            <button data-v="easy">Easy</button>
            <button data-v="difficult">Difficult</button>
            <button data-v="verydifficult">Very Difficult</button>
          </div>
        </div>
        <div class="settings-row">
          <label>Range</label>
          <div class="range-inputs">
            <input type="number" class="range-input cc-min" value="${cfg.min}">
            <span class="dim">to</span>
            <input type="number" class="range-input cc-max" value="${cfg.max}">
          </div>
        </div>
        ${isAdd ? `
        <div class="settings-row">
          <label>How many numbers</label>
          <div class="segmented cc-count">
            <button data-v="2" class="${(cfg.count||2)===2?'active':''}">2</button>
            <button data-v="3" class="${(cfg.count||2)===3?'active':''}">3</button>
            <button data-v="4" class="${(cfg.count||2)===4?'active':''}">4</button>
            <button data-v="5" class="${(cfg.count||2)===5?'active':''}">5</button>
          </div>
        </div>` : ''}
        <div class="settings-row">
          <label>Number type</label>
          <div class="segmented cc-parity">
            <button data-v="any" class="${cfg.parity==='any'?'active':''}">Any</button>
            <button data-v="even" class="${cfg.parity==='even'?'active':''}">Even only</button>
            <button data-v="odd" class="${cfg.parity==='odd'?'active':''}">Odd only</button>
          </div>
        </div>
      </div>
    `;
    challengeSkillConfigs.appendChild(card);
  });
}

// Delegated listeners for all dynamically-created config cards
challengeSkillConfigs.addEventListener('click', (e) => {
  const diffBtn = e.target.closest('.cc-difficulty button');
  if(diffBtn){
    const card = diffBtn.closest('.challenge-skill-config');
    const key = card.dataset.skill;
    const preset = DIFFICULTY_PRESETS[key]?.[diffBtn.dataset.v];
    if(!preset) return;
    [...card.querySelectorAll('.cc-difficulty button')].forEach(b => b.classList.remove('active'));
    diffBtn.classList.add('active');
    challengeDraftConfig[key].min = preset.min;
    challengeDraftConfig[key].max = preset.max;
    card.querySelector('.cc-min').value = preset.min;
    card.querySelector('.cc-max').value = preset.max;
    if(key === 'add' && preset.count){
      challengeDraftConfig[key].count = preset.count;
      card.querySelectorAll('.cc-count button').forEach(b => b.classList.toggle('active', b.dataset.v === String(preset.count)));
    }
    return;
  }
  const countBtn = e.target.closest('.cc-count button');
  if(countBtn){
    const card = countBtn.closest('.challenge-skill-config');
    const key = card.dataset.skill;
    card.querySelectorAll('.cc-count button').forEach(b => b.classList.remove('active'));
    countBtn.classList.add('active');
    challengeDraftConfig[key].count = parseInt(countBtn.dataset.v, 10);
    card.querySelectorAll('.cc-difficulty button').forEach(b => b.classList.remove('active'));
    return;
  }
  const btn = e.target.closest('.cc-parity button');
  if(!btn) return;
  const card = btn.closest('.challenge-skill-config');
  const key = card.dataset.skill;
  [...card.querySelectorAll('.cc-parity button')].forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  challengeDraftConfig[key].parity = btn.dataset.v;
});
challengeSkillConfigs.addEventListener('change', (e) => {
  const input = e.target.closest('input.range-input');
  if(!input) return;
  const card = input.closest('.challenge-skill-config');
  const key = card.dataset.skill;
  const val = parseInt(input.value, 10);
  if(Number.isNaN(val)) return;
  if(input.classList.contains('cc-min')) challengeDraftConfig[key].min = val;
  if(input.classList.contains('cc-max')) challengeDraftConfig[key].max = val;
  card.querySelectorAll('.cc-difficulty button').forEach(b => b.classList.remove('active'));
});

challengeDurationToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if(!btn) return;
  [...challengeDurationToggle.children].forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  challengeDraftQuestions = parseInt(btn.dataset.n, 10);
});

function showGeneratedCode(code){
  challengeCodeText.textContent = code;
  challengeShowModal.classList.add('show');
}

btnChallengeGenerate.addEventListener('click', () => {
  const included = SKILL_ORDER.filter(k => challengeDraftIncluded[k]);
  if(included.length === 0) return;
  const seed = randomSeed();
  const payload = buildChallengePayload(included, challengeDraftConfig, challengeDraftQuestions, seed);
  showGeneratedCode(encodeChallengeCode(payload));
});

// TODO (Step 5): the new Home mockup has no "Create challenge" entry point button
// (old Home had one). Guarding this so the app doesn't crash on load — Step 5 needs
// to design where this and "Enter a code" live in the new UI.
if(btnChallengeCreate) btnChallengeCreate.addEventListener('click', openChallengeScreen);
document.getElementById('btnChallengeBack').addEventListener('click', () => showView('home'));

document.getElementById('btnChallengeShowClose').addEventListener('click', () => {
  challengeShowModal.classList.remove('show');
});
document.getElementById('btnChallengeCopy').addEventListener('click', () => {
  const text = challengeCodeText.textContent;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).catch(()=>{});
  }
  const btn = document.getElementById('btnChallengeCopy');
  const original = btn.textContent;
  btn.textContent = 'Copied';
  setTimeout(() => { btn.textContent = original; }, 1200);
});
challengeShowModal.addEventListener('click', (e) => {
  if(e.target === challengeShowModal) challengeShowModal.classList.remove('show');
});

// ---------- challenge codes: enter ----------
const challengeEnterModal = document.getElementById('challengeEnterModal');
const challengeCodeInput = document.getElementById('challengeCodeInput');
const challengeEnterError = document.getElementById('challengeEnterError');

const btnChallengeEnter = document.getElementById('btnChallengeEnter');
if(btnChallengeEnter) btnChallengeEnter.addEventListener('click', () => {
  challengeCodeInput.value = '';
  challengeEnterError.style.display = 'none';
  challengeEnterModal.classList.add('show');
});
document.getElementById('btnChallengeEnterCancel').addEventListener('click', () => {
  challengeEnterModal.classList.remove('show');
});
challengeEnterModal.addEventListener('click', (e) => {
  if(e.target === challengeEnterModal) challengeEnterModal.classList.remove('show');
});
document.getElementById('btnChallengeEnterGo').addEventListener('click', () => {
  const payload = decodeChallengeCode(challengeCodeInput.value);
  const validSkills = payload && payload.included.every(k => SKILLS[k]) && payload.included.length > 0
    && Number.isInteger(payload.n) && payload.n > 0;
  if(!validSkills){
    challengeEnterError.style.display = 'block';
    return;
  }
  pendingChallenge = payload;
  state.practiceMode = false;
  practiceCheckbox.checked = false;
  challengeEnterModal.classList.remove('show');
  startRound();
});

// History button: toggles into/out of the History view. Disabled entirely during a running round.
btnHistory.addEventListener('click', () => {
  if(state.running) return; // guarded, but also visually disabled during play
  if(views.history.classList.contains('active')){
    showView('home');
  } else {
    renderHistory();
    showView('history');
  }
});
