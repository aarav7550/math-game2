// ============================================================
// HISTORY.JS — History Overview, Skill Detail, Full History, export/import
// All three screens draw their graph with the SAME shared TrendChart module the
// Home dashboard uses (js/trendchart.js) — no History-only chart variant.
// Depends on (loaded earlier): storage.js (sessions, saveSessions), skills.js (showView),
// game.js (difficultyLabels), ui.js (SKILL_ICON, SKILL_CLASS, skillDisplayLabels,
// matchingDifficultyForConfig), trendchart.js (TrendChart).
// ============================================================

const historySkillLabels = { half:'Halving', x2:'× 2', x3:'× 3', add:'Additions', mixed:'Mixed' };
const PARITY_LABEL = { any:'Any', even:'Even only', odd:'Odd only' };
const FULL_PAGE_SIZE = 15;

// ---------- small helpers ----------
function fmtSessionDate(ts){
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const time = d.toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' });
  const day = sameDay ? 'Today' : d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
  return day + ', ' + time;
}

function sessionLevelInfo(s){
  // Mixed rounds have no single range to show, so they get a plain non-clickable label.
  if(s.skill === 'mixed' || !s.config || !s.config.cfg) return { label: s.skill === 'mixed' ? 'Mixed' : '—', range: null, type: null };
  const cfg = s.config.cfg;
  return {
    label: difficultyLabels[matchingDifficultyForConfig(s.skill, cfg)],
    range: cfg.min + '–' + cfg.max,
    type: PARITY_LABEL[cfg.parity] || 'Any'
  };
}

function trendPointsFor(list){
  return list.map(s => ({ ts: s.date, val: s.avgTime, acc: s.accuracy }));
}

// One row. `withSkill` false = Skill Detail layout (no skill column, page is already one skill).
function sessionRowHtml(s, withSkill){
  const lv = sessionLevelInfo(s);
  const levelCell = lv.range
    ? '<div class="sr-cell sr-level"><span class="sr-level-txt">' + lv.label + '</span></div>'
    : '<div class="sr-cell sr-level-static">' + lv.label + '</div>';
  const popover = lv.range
    ? '<div class="level-popover">'
      + '<div class="lp-row"><span>Range</span><b>' + lv.range + '</b></div>'
      + '<div class="lp-row"><span>Type</span><b>' + lv.type + '</b></div>'
      + '</div>'
    : '';
  const line2 = '<div class="sr-line2">'
    + levelCell
    + '<div class="sr-cell sr-qs">' + (s.questions || '—') + ' Qs</div>'
    + '<div class="sr-cell sr-avg">' + s.avgTime.toFixed(1) + 's avg</div>'
    + '<div class="sr-cell sr-acc">' + s.accuracy + '% acc</div>'
    + '</div>';
  if(withSkill){
    return '<div class="session-row">'
      + '<div class="sr-line1">'
      +   '<div class="sr-cell sr-date">' + fmtSessionDate(s.date) + '</div>'
      +   '<div class="sr-cell sr-skill">' + (historySkillLabels[s.skill] || s.skill) + '</div>'
      + '</div>'
      + line2 + popover + '</div>';
  }
  return '<div class="session-row">'
    + '<div class="sr-cell sr-date">' + fmtSessionDate(s.date) + '</div>'
    + line2 + popover + '</div>';
}

// ---------- level popover (one-time delegation per stable list container) ----------
let openLevelPop = null;
function closeLevelPop(){ if(openLevelPop){ openLevelPop.classList.remove('show'); openLevelPop = null; } }
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
function popFor(cell){ return cell.closest('.session-row').querySelector('.level-popover'); }
function wireLevelPopovers(list){
  list.addEventListener('click', (e) => {
    const cell = e.target.closest('.sr-level');
    if(!cell){ closeLevelPop(); return; }
    const pop = popFor(cell);
    if(!pop) return;
    if(openLevelPop && openLevelPop !== pop) openLevelPop.classList.remove('show');
    const willShow = !pop.classList.contains('show');
    if(willShow) positionLevelPop(cell, pop); else pop.classList.remove('show');
    openLevelPop = willShow ? pop : null;
    e.stopPropagation();
  });
  // desktop only: hover also reveals it (skipped on touch, where the first tap would only fire hover)
  if(window.matchMedia('(hover: hover)').matches){
    list.addEventListener('mouseover', (e) => {
      const cell = e.target.closest('.sr-level');
      if(!cell || cell.contains(e.relatedTarget)) return;
      const pop = popFor(cell);
      if(pop) positionLevelPop(cell, pop);
    });
    list.addEventListener('mouseout', (e) => {
      const cell = e.target.closest('.sr-level');
      if(!cell || cell.contains(e.relatedTarget)) return;
      const pop = popFor(cell);
      if(pop && pop !== openLevelPop) pop.classList.remove('show');
    });
  }
}
document.addEventListener('click', closeLevelPop);

// ---------- icon-button tooltips (touch: long-press shows it; mouse: hover) ----------
function wireTooltipBtn(btnId, tipId){
  const btn = document.getElementById(btnId), tip = document.getElementById(tipId);
  if(!btn || !tip) return;
  let timer = null;
  btn.addEventListener('touchstart', () => { timer = setTimeout(() => tip.classList.add('show'), 350); }, {passive:true});
  btn.addEventListener('touchend', () => { clearTimeout(timer); setTimeout(() => tip.classList.remove('show'), 1200); });
  btn.addEventListener('mouseenter', () => tip.classList.add('show'));
  btn.addEventListener('mouseleave', () => tip.classList.remove('show'));
}

// ---------- shared trend card (Overview + Skill Detail) ----------
// els: { mount, title, curAvg, curAcc, growth, growthLbl }
function renderTrendCard(els, points){
  const result = TrendChart.mount(els.mount, points);
  const pts = result ? result.pts : [];

  els.title.textContent = points.length === 0 ? 'Getting started' : 'Your progress';

  if(pts.length === 0){
    els.curAvg.textContent = '—';
    els.curAcc.textContent = '—';
    els.growth.textContent = '—';
    els.growth.className = 'num';
    els.growthLbl.textContent = '';
    return;
  }

  const first = pts[0], last = pts[pts.length - 1];
  els.curAvg.textContent = last.val.toFixed(1) + 's';
  els.curAcc.textContent = Math.round(last.acc) + '%';

  if(pts.length < 2 || first.val <= 0){
    els.growth.textContent = '—';
    els.growth.className = 'num';
    els.growthLbl.textContent = 'play on another day to see growth';
    return;
  }
  const pct = Math.round(((first.val - last.val) / first.val) * 100);
  els.growth.textContent = (pct >= 0 ? '+' : '') + pct + '%';
  els.growth.className = 'num ' + (pct >= 0 ? 'pos' : 'neg');
  els.growthLbl.textContent = (pct >= 0 ? 'faster' : 'slower') + ' vs ' + first.label;
  els.title.textContent = pct >= 3 ? 'Getting faster' : (pct <= -3 ? 'Slowing down' : 'Holding steady');
}

// ============================================================
// OVERVIEW
// ============================================================
const histEls = {
  mount: document.getElementById('histTrend'),
  title: document.getElementById('histTrendTitle'),
  curAvg: document.getElementById('histCurrentAvg'),
  curAcc: document.getElementById('histCurrentAcc'),
  growth: document.getElementById('histGrowth'),
  growthLbl: document.getElementById('histGrowthLbl')
};
const sessionsListEl = document.getElementById('sessionsList');
const histSkillGridEl = document.getElementById('histSkillGrid');
const CHEVRON_SVG = '<svg class="sk-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';

function renderHistSkillGrid(){
  histSkillGridEl.innerHTML = '';
  SKILL_ORDER.forEach(key => {
    const list = sessions.filter(s => s.skill === key);
    const has = list.length > 0;
    const avg = has ? list.reduce((a, s) => a + s.avgTime, 0) / list.length : null;
    const acc = has ? Math.round(list.reduce((a, s) => a + s.accuracy, 0) / list.length) : null;
    const card = document.createElement('button');
    card.className = 'skill-card ' + SKILL_CLASS[key];
    card.dataset.skill = key;
    card.innerHTML =
      '<div class="sk-top"><div class="sk-top-left"><div class="sk-icon">' + SKILL_ICON[key] + '</div>'
      + '<div class="sk-name">' + skillDisplayLabels[key] + '</div></div>' + CHEVRON_SVG + '</div>'
      + '<div class="sk-nums">'
      +   '<div class="sk-stat"><div class="num">' + (has ? avg.toFixed(1) + 's' : '—') + '</div><div class="lbl">Avg time</div></div>'
      +   '<div class="sk-stat"><div class="num">' + (has ? acc + '%' : '—') + '</div><div class="lbl">Accuracy</div></div>'
      + '</div>';
    histSkillGridEl.appendChild(card);
  });
}

function renderRecentSessions(){
  const seeAll = document.getElementById('btnSeeFullHistory');
  if(sessions.length === 0){
    sessionsListEl.innerHTML = '<div class="empty-list-note">No rounds played yet — finish a round to see it here.</div>';
    seeAll.style.display = 'none';
    return;
  }
  seeAll.style.display = 'block';
  sessionsListEl.innerHTML = sessions.slice(-10).reverse().map(s => sessionRowHtml(s, true)).join('');
}

function renderHistory(){
  closeLevelPop();
  renderTrendCard(histEls, trendPointsFor(sessions));
  renderHistSkillGrid();
  renderRecentSessions();
}

wireLevelPopovers(sessionsListEl);
histSkillGridEl.addEventListener('click', (e) => {
  const card = e.target.closest('.skill-card');
  if(card) openSkillDetail(card.dataset.skill);
});
document.getElementById('btnSeeFullHistory').addEventListener('click', () => openFullHistory());
wireTooltipBtn('btnExportHistory', 'tipExportHistory');
wireTooltipBtn('btnImportHistory', 'tipImportHistory');

// ============================================================
// SKILL DETAIL
// ============================================================
const skdEls = {
  mount: document.getElementById('skdTrend'),
  title: document.getElementById('skdTrendTitle'),
  curAvg: document.getElementById('skdCurrentAvg'),
  curAcc: document.getElementById('skdCurrentAcc'),
  growth: document.getElementById('skdGrowth'),
  growthLbl: document.getElementById('skdGrowthLbl')
};
const skdListEl = document.getElementById('skdSessionsList');
const skdEmptyNote = document.getElementById('skdEmptyNote');
let skdCurrentKey = null;

function renderSkillDetail(){
  const key = skdCurrentKey;
  if(!key) return;
  closeLevelPop();
  const label = skillDisplayLabels[key];
  const list = sessions.filter(s => s.skill === key);

  const icon = document.getElementById('skdPageTitleIcon');
  icon.textContent = SKILL_ICON[key];
  icon.style.background = 'var(--sk-' + key + '-soft)';
  icon.style.color = 'var(--sk-' + key + ')';
  document.getElementById('skdPageTitleText').textContent = label;
  document.getElementById('skdTrendDesc').textContent = 'Average answer time per session, ' + label;
  document.getElementById('skdSectionLabel').textContent = 'All sessions — ' + label;

  renderTrendCard(skdEls, trendPointsFor(list));

  if(list.length === 0){
    skdListEl.innerHTML = '';
    skdEmptyNote.style.display = 'block';
    skdEmptyNote.textContent = 'No ' + label + ' rounds yet — play one to see it here.';
  } else {
    skdEmptyNote.style.display = 'none';
    skdListEl.innerHTML = list.slice().reverse().map(s => sessionRowHtml(s, false)).join('');
  }
}

function openSkillDetail(key){
  skdCurrentKey = key;
  renderSkillDetail();
  showView('historySkill');
}

wireLevelPopovers(skdListEl);
wireTooltipBtn('btnSkdExport', 'tipSkdExport');
wireTooltipBtn('btnSkdImport', 'tipSkdImport');

// ============================================================
// FULL HISTORY (15 per page)
// ============================================================
const fullListEl = document.getElementById('fullSessionsList');
const fullPaginationEl = document.getElementById('fullPagination');
const fullCountNoteEl = document.getElementById('fullCountNote');
const fullEmptyEl = document.getElementById('fullEmptyState');
let fullPage = 1;

function renderFullHistory(){
  closeLevelPop();
  const total = sessions.length;
  if(total === 0){
    fullListEl.innerHTML = '';
    fullPaginationEl.innerHTML = '';
    fullCountNoteEl.textContent = '';
    fullEmptyEl.style.display = 'block';
    return;
  }
  fullEmptyEl.style.display = 'none';
  const pages = Math.max(1, Math.ceil(total / FULL_PAGE_SIZE));
  fullPage = Math.min(Math.max(1, fullPage), pages);
  const slice = sessions.slice().reverse().slice((fullPage - 1) * FULL_PAGE_SIZE, fullPage * FULL_PAGE_SIZE);
  fullCountNoteEl.textContent = total + (total === 1 ? ' session total' : ' sessions total');
  fullListEl.innerHTML = slice.map(s => sessionRowHtml(s, true)).join('');

  const nums = [];
  for(let p = 1; p <= pages; p++){
    if(p === 1 || p === pages || Math.abs(p - fullPage) <= 1) nums.push(p);
    else if(nums[nums.length - 1] !== '…') nums.push('…');
  }
  const chev = (d) => '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
  let html = '<button class="page-btn page-nav-btn" data-page="' + (fullPage - 1) + '"' + (fullPage === 1 ? ' disabled' : '') + '>' + chev('M15 18l-6-6 6-6') + 'Prev</button>';
  nums.forEach(n => {
    html += n === '…'
      ? '<span class="page-ellipsis">…</span>'
      : '<button class="page-btn' + (n === fullPage ? ' active' : '') + '" data-page="' + n + '">' + n + '</button>';
  });
  html += '<button class="page-btn page-nav-btn" data-page="' + (fullPage + 1) + '"' + (fullPage === pages ? ' disabled' : '') + '>Next' + chev('M9 18l6-6-6-6') + '</button>';
  fullPaginationEl.innerHTML = html;
}

function openFullHistory(){
  fullPage = 1;
  renderFullHistory();
  showView('historyFull');
}

wireLevelPopovers(fullListEl);
fullPaginationEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.page-btn');
  if(!btn || btn.disabled || btn.classList.contains('active')) return;
  fullPage = parseInt(btn.dataset.page, 10);
  renderFullHistory();
  const v = document.getElementById('view-history-full');
  if(v) v.scrollTop = 0;
});

// ============================================================
// EXPORT / IMPORT (always ALL sessions, shared by Overview and Skill Detail buttons)
// ============================================================
function exportHistory(){
  const blob = new Blob([JSON.stringify(sessions, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'numbers-history-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
document.getElementById('btnExportHistory').addEventListener('click', exportHistory);
document.getElementById('btnSkdExport').addEventListener('click', exportHistory);

const importFileInput = document.getElementById('importFileInput');
document.getElementById('btnImportHistory').addEventListener('click', () => importFileInput.click());
document.getElementById('btnSkdImport').addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const imported = JSON.parse(reader.result);
      if(!Array.isArray(imported)) throw new Error('bad format');
      const existingDates = new Set(sessions.map(s => s.date));
      const merged = sessions.concat(imported.filter(s => s && typeof s.date === 'number' && !existingDates.has(s.date)));
      merged.sort((a, b) => a.date - b.date);
      sessions = merged;
      saveSessions(sessions);
      renderHistory();
      if(document.getElementById('view-history-skill').classList.contains('active')) renderSkillDetail();
      if(document.getElementById('view-history-full').classList.contains('active')) renderFullHistory();
      if(typeof renderHomeDashboard === 'function') renderHomeDashboard();
    }catch(err){
      alert('Could not read that file — make sure it\'s a history export from this app.');
    }
  };
  reader.readAsText(file);
  importFileInput.value = '';
});
