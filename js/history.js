// ============================================================
// HISTORY.JS — History Overview screen (Step 4a)
// Trend card (shared TrendChart module), per-skill grid, recent sessions
// list with a range/type popover, export/import.
//
// Step 4b (not yet built): "See full history" and tapping a skill card are
// left as guarded no-ops — they should open Full History / Skill Detail.
// ============================================================

// 'mixed' isn't in skillDisplayLabels (ui.js only covers the 4 real skills),
// but a session can be 'mixed' if it came from a multi-skill challenge code.
const SKILL_LABEL_ALL = Object.assign({ mixed: 'Mixed' }, skillDisplayLabels);

// ---------- helpers ----------
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatSessionDate(ts){
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const time = d.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});
  return (isToday ? 'Today' : (MONTH_SHORT[d.getMonth()] + ' ' + d.getDate())) + ', ' + time;
}

// Difficulty label + range/parity detail for one session's level popover.
// Mixed-skill sessions (challenge codes) don't have one single range to show,
// so they just show "Mixed" with no clickable detail.
function sessionLevelInfo(s){
  if(s.skill === 'mixed' || !s.config || !s.config.cfg){
    return { level: 'Mixed', hasDetail: false };
  }
  const cfg = s.config.cfg;
  const level = difficultyLabels[matchingDifficultyForConfig(s.skill, cfg)];
  const range = cfg.min + '–' + cfg.max + (s.skill === 'add' ? (', ' + (cfg.count || 2) + ' nums') : '');
  const parityLabel = { any:'Any', even:'Even only', odd:'Odd only' }[cfg.parity] || 'Any';
  return { level, range, parity: parityLabel, hasDetail: true };
}

// ---------- trend card (title, chart, current avg/acc, growth stat) ----------
function renderHistTrend(){
  const trendPoints = sessions.map(s => ({ ts: s.date, val: s.avgTime, acc: s.accuracy }));
  const mounted = TrendChart.mount(document.getElementById('histTrend'), trendPoints);

  const titleEl = document.getElementById('histTrendTitle');
  const avgEl = document.getElementById('histCurrentAvg');
  const accEl = document.getElementById('histCurrentAcc');
  const growthEl = document.getElementById('histGrowth');
  const growthLblEl = document.getElementById('histGrowthLbl');

  if(!mounted || mounted.pts.length === 0){
    titleEl.textContent = 'Getting started';
    avgEl.textContent = '—';
    accEl.textContent = '—';
    growthEl.textContent = '—';
    growthEl.className = 'num';
    growthLblEl.textContent = '';
    return;
  }

  const pts = mounted.pts; // oldest -> newest
  const last = pts[pts.length - 1];
  avgEl.textContent = last.val.toFixed(1) + 's';
  accEl.textContent = last.acc + '%';

  if(pts.length < 2){
    titleEl.textContent = 'Your progress';
    growthEl.textContent = '—';
    growthEl.className = 'num';
    growthLblEl.textContent = 'play more to see a trend';
    return;
  }

  const first = pts[0];
  const pct = first.val === 0 ? 0 : Math.round(((first.val - last.val) / first.val) * 100);
  titleEl.textContent = pct > 2 ? 'Getting faster' : (pct < -2 ? 'Slowing down' : 'Holding steady');
  growthEl.textContent = (pct >= 0 ? '+' : '') + pct + '%';
  growthEl.className = 'num ' + (pct >= 0 ? 'pos' : 'neg');
  growthLblEl.textContent = (pct >= 0 ? 'faster' : 'slower') + ' vs ' + first.label;
}

// ---------- per-skill grid (side column) ----------
function renderHistSkillGrid(){
  const grid = document.getElementById('histSkillGrid');
  grid.innerHTML = '';
  SKILL_ORDER.forEach(key => {
    const skillSessions = sessions.filter(s => s.skill === key);
    const hasData = skillSessions.length > 0;
    const avg = hasData ? skillSessions.reduce((a,s) => a+s.avgTime, 0) / skillSessions.length : null;
    const acc = hasData ? Math.round(skillSessions.reduce((a,s) => a+s.accuracy, 0) / skillSessions.length) : null;

    const card = document.createElement('button');
    card.className = 'skill-card ' + SKILL_CLASS[key];
    card.dataset.skill = key;
    card.innerHTML = `
      <div class="sk-top">
        <div class="sk-top-left">
          <div class="sk-icon">${SKILL_ICON[key]}</div>
          <div class="sk-name">${skillDisplayLabels[key]}</div>
        </div>
        <svg class="sk-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </div>
      <div class="sk-nums">
        <div class="sk-stat"><div class="num">${hasData ? avg.toFixed(1)+'s' : '—'}</div><div class="lbl">Avg time</div></div>
        <div class="sk-stat"><div class="num">${hasData ? acc+'%' : '—'}</div><div class="lbl">Accuracy</div></div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function openSkillDetail(key){
  // TODO (Step 4b): Skill Detail screen doesn't exist yet — no-op for now.
}
document.getElementById('histSkillGrid').addEventListener('click', (e) => {
  const card = e.target.closest('.skill-card');
  if(!card) return;
  openSkillDetail(card.dataset.skill);
});

// ---------- recent sessions list ----------
const RECENT_SESSIONS_SHOWN = 10;

function renderRecentSessions(){
  const list = document.getElementById('sessionsList');
  if(sessions.length === 0){
    list.innerHTML = '<div class="empty-state">No rounds played yet. Finish a round to see it here.</div>';
    return;
  }
  const recent = [...sessions].reverse().slice(0, RECENT_SESSIONS_SHOWN);
  list.innerHTML = recent.map((s, i) => {
    const info = sessionLevelInfo(s);
    const levelCell = info.hasDetail
      ? `<div class="sr-cell sr-level" data-idx="${i}"><span class="sr-level-txt">${info.level}</span></div>`
      : `<div class="sr-cell sr-level">${info.level}</div>`;
    const popover = info.hasDetail
      ? `<div class="level-popover" id="lp-${i}">
          <div class="lp-row"><span>Range</span><b>${info.range}</b></div>
          <div class="lp-row"><span>Type</span><b>${info.parity}</b></div>
        </div>`
      : '';
    return `<div class="session-row">
      <div class="sr-line1">
        <div class="sr-cell sr-date">${formatSessionDate(s.date)}</div>
        <div class="sr-cell sr-skill">${SKILL_LABEL_ALL[s.skill] || s.skill}</div>
      </div>
      <div class="sr-line2">
        ${levelCell}
        <div class="sr-cell sr-qs">${s.questions || '—'} Qs</div>
        <div class="sr-cell sr-avg">${s.avgTime.toFixed(1)}s avg</div>
        <div class="sr-cell sr-acc">${s.accuracy}% acc</div>
      </div>
      ${popover}
    </div>`;
  }).join('');
}

// Level popover: clicking/tapping a level cell toggles a small box with that
// session's exact range/type. One-time delegation on the stable #sessionsList
// parent (not re-bound per render) since the list is rebuilt every renderHistory().
let openLevelPop = null;
function closeLevelPop(){
  if(openLevelPop){ openLevelPop.classList.remove('show'); openLevelPop = null; }
}
function positionLevelPop(cell, pop){
  const row = cell.closest('.session-row');
  const txt = cell.querySelector('.sr-level-txt') || cell;
  const rowRect = row.getBoundingClientRect(), txtRect = txt.getBoundingClientRect();
  const anchorCenter = (txtRect.left - rowRect.left) + txtRect.width / 2;
  const anchorBottom = (txtRect.bottom - rowRect.top) + 10;
  pop.style.left = '0px';
  pop.style.top = anchorBottom + 'px';
  pop.style.setProperty('--lp-arrow-x', '16px');
  pop.classList.add('show');
  const popW = pop.offsetWidth;
  const left = Math.min(Math.max(0, anchorCenter - popW / 2), rowRect.width - popW);
  pop.style.left = left + 'px';
  pop.style.setProperty('--lp-arrow-x', (anchorCenter - left) + 'px');
}
const sessionsListEl = document.getElementById('sessionsList');
sessionsListEl.addEventListener('click', (e) => {
  const cell = e.target.closest('.sr-level');
  if(!cell){ closeLevelPop(); return; }
  const pop = document.getElementById('lp-' + cell.dataset.idx);
  if(!pop) return;
  if(openLevelPop && openLevelPop !== pop) openLevelPop.classList.remove('show');
  const willShow = !pop.classList.contains('show');
  if(willShow) positionLevelPop(cell, pop); else pop.classList.remove('show');
  openLevelPop = willShow ? pop : null;
  e.stopPropagation();
});
document.addEventListener('click', closeLevelPop);
// Desktop only: hover also reveals it. Skipped on touch — otherwise the first
// tap only triggers the synthetic hover state and needs a second tap to click.
if(window.matchMedia('(hover: hover)').matches){
  sessionsListEl.addEventListener('mouseover', (e) => {
    const cell = e.target.closest('.sr-level');
    if(!cell) return;
    const pop = document.getElementById('lp-' + cell.dataset.idx);
    if(pop) positionLevelPop(cell, pop);
  });
  sessionsListEl.addEventListener('mouseout', (e) => {
    const cell = e.target.closest('.sr-level');
    if(!cell) return;
    const pop = document.getElementById('lp-' + cell.dataset.idx);
    if(pop && pop !== openLevelPop) pop.classList.remove('show');
  });
}

document.getElementById('btnSeeFullHistory').addEventListener('click', () => {
  // TODO (Step 4b): Full History screen doesn't exist yet — no-op for now.
});

// ---------- topbar: back + export/import (with hover/touch tooltips) ----------
document.getElementById('btnHistoryBack').addEventListener('click', () => showView('home'));

function wireTooltipBtn(btnId, tipId){
  const btn = document.getElementById(btnId), tip = document.getElementById(tipId);
  let timer = null;
  btn.addEventListener('touchstart', () => { timer = setTimeout(() => tip.classList.add('show'), 350); }, {passive:true});
  btn.addEventListener('touchend', () => { clearTimeout(timer); setTimeout(() => tip.classList.remove('show'), 1200); });
  btn.addEventListener('mouseenter', () => tip.classList.add('show'));
  btn.addEventListener('mouseleave', () => tip.classList.remove('show'));
}
wireTooltipBtn('btnExportHistory', 'tipExportHistory');
wireTooltipBtn('btnImportHistory', 'tipImportHistory');

document.getElementById('btnExportHistory').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(sessions, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  a.href = url;
  a.download = `numbers-history-${d.toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

const importFileInput = document.getElementById('importFileInput');
document.getElementById('btnImportHistory').addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const imported = JSON.parse(reader.result);
      if(!Array.isArray(imported)) throw new Error('bad format');
      const existingDates = new Set(sessions.map(s => s.date));
      const merged = sessions.concat(imported.filter(s => !existingDates.has(s.date)));
      merged.sort((a,b) => a.date - b.date);
      sessions = merged;
      saveSessions(sessions);
      renderHistory();
    }catch(err){
      alert('Could not read that file — make sure it\'s a history export from this app.');
    }
  };
  reader.readAsText(file);
  importFileInput.value = '';
});

// ---------- entry point (called by ui.js's btnHistory / historyCard handlers) ----------
function renderHistory(){
  renderHistTrend();
  renderHistSkillGrid();
  renderRecentSessions();
}
