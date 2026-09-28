// ============================================================
// HISTORY.JS — History screens (Step 4)
//   4a: Overview  (trend card, per-skill grid, recent sessions)
//   4b: Skill Detail (one skill's trend + all its sessions)
//       Full History (every session, paginated)
// All three share: TrendChart, one level-popover helper, one export/import.
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

// The popover is a plain sibling inside the same .session-row as its level cell,
// so no per-row ids are needed and the same markup works on all three lists.
function levelCellHtml(info){
  return info.hasDetail
    ? `<div class="sr-cell sr-level"><span class="sr-level-txt">${info.level}</span></div>`
    : `<div class="sr-cell sr-level">${info.level}</div>`;
}
function levelPopoverHtml(info){
  return info.hasDetail
    ? `<div class="level-popover">
        <div class="lp-row"><span>Range</span><b>${info.range}</b></div>
        <div class="lp-row"><span>Type</span><b>${info.parity}</b></div>
      </div>`
    : '';
}

// ---------- trend card (shared by Overview + Skill Detail) ----------
// points: [{ ts, val, acc }] one per session; TrendChart itself averages them per day.
function renderTrendCard(els, points){
  const mounted = TrendChart.mount(els.mount, points, { legend:false, tooltip:'point' });

  if(!mounted || mounted.pts.length === 0){
    els.title.textContent = 'Getting started';
    els.avg.textContent = '—';
    els.acc.textContent = '—';
    els.growth.textContent = '—';
    els.growth.className = 'num';
    els.growthLbl.textContent = '';
    return;
  }

  const pts = mounted.pts; // oldest -> newest, one per day
  const last = pts[pts.length - 1];
  els.avg.textContent = last.val.toFixed(1) + 's';
  els.acc.textContent = Math.round(last.acc) + '%';

  if(pts.length < 2){
    els.title.textContent = 'Your progress';
    els.growth.textContent = '—';
    els.growth.className = 'num';
    els.growthLbl.textContent = 'play more to see a trend';
    return;
  }

  const first = pts[0];
  const pct = first.val === 0 ? 0 : Math.round(((first.val - last.val) / first.val) * 100);
  els.title.textContent = pct > 2 ? 'Getting faster' : (pct < -2 ? 'Slowing down' : 'Holding steady');
  els.growth.textContent = (pct >= 0 ? '+' : '') + pct + '%';
  els.growth.className = 'num ' + (pct >= 0 ? 'pos' : 'neg');
  els.growthLbl.textContent = (pct >= 0 ? 'faster' : 'slower') + ' vs ' + first.label;
}
function sessionsToPoints(list){
  return list.map(s => ({ ts: s.date, val: s.avgTime, acc: s.accuracy }));
}

function renderHistTrend(){
  renderTrendCard({
    mount: document.getElementById('histTrend'),
    title: document.getElementById('histTrendTitle'),
    avg: document.getElementById('histCurrentAvg'),
    acc: document.getElementById('histCurrentAcc'),
    growth: document.getElementById('histGrowth'),
    growthLbl: document.getElementById('histGrowthLbl')
  }, sessionsToPoints(sessions));
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
document.getElementById('histSkillGrid').addEventListener('click', (e) => {
  const card = e.target.closest('.skill-card');
  if(!card) return;
  openSkillDetail(card.dataset.skill);
});

// ---------- shared level popover ----------
// Wired ONCE per stable list container (never re-bound per render). Clicking/tapping a
// level cell toggles a small box with that session's exact range/type; on hover-capable
// devices hovering also reveals it.
function wireLevelPopovers(listEl){
  let openPop = null;
  function closePop(){ if(openPop){ openPop.classList.remove('show'); openPop = null; } }
  function popFor(cell){
    const row = cell.closest('.session-row');
    return row ? row.querySelector('.level-popover') : null;
  }
  function positionPop(cell, pop){
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
  listEl.addEventListener('click', (e) => {
    const cell = e.target.closest('.sr-level');
    if(!cell){ closePop(); return; }
    const pop = popFor(cell);
    if(!pop) return;
    if(openPop && openPop !== pop) openPop.classList.remove('show');
    const willShow = !pop.classList.contains('show');
    if(willShow) positionPop(cell, pop); else pop.classList.remove('show');
    openPop = willShow ? pop : null;
    e.stopPropagation();
  });
  document.addEventListener('click', (e) => { if(!listEl.contains(e.target)) closePop(); });
  // Desktop only: hover also reveals it. Skipped on touch — otherwise the first
  // tap only triggers the synthetic hover state and needs a second tap to click.
  if(window.matchMedia('(hover: hover)').matches){
    listEl.addEventListener('mouseover', (e) => {
      const cell = e.target.closest('.sr-level');
      if(!cell) return;
      const pop = popFor(cell);
      if(pop && !pop.classList.contains('show')) positionPop(cell, pop);
    });
    listEl.addEventListener('mouseout', (e) => {
      const cell = e.target.closest('.sr-level');
      if(!cell) return;
      const pop = popFor(cell);
      if(pop && pop !== openPop) pop.classList.remove('show');
    });
  }
}

// ---------- session row markup (Overview + Full History share this one) ----------
function sessionRowHtml(s){
  const info = sessionLevelInfo(s);
  return `<div class="session-row">
    <div class="sr-line1">
      <div class="sr-cell sr-date">${formatSessionDate(s.date)}</div>
      <div class="sr-cell sr-skill">${SKILL_LABEL_ALL[s.skill] || s.skill}</div>
    </div>
    <div class="sr-line2">
      ${levelCellHtml(info)}
      <div class="sr-cell sr-qs">${s.questions || '—'} Qs</div>
      <div class="sr-cell sr-avg">${s.avgTime.toFixed(1)}s avg</div>
      <div class="sr-cell sr-acc">${s.accuracy}% acc</div>
    </div>
    ${levelPopoverHtml(info)}
  </div>`;
}

// ---------- Overview: recent sessions ----------
const RECENT_SESSIONS_SHOWN = 10;
function renderRecentSessions(){
  const list = document.getElementById('sessionsList');
  if(sessions.length === 0){
    list.innerHTML = '<div class="empty-state">No rounds played yet. Finish a round to see it here.</div>';
    return;
  }
  list.innerHTML = [...sessions].reverse().slice(0, RECENT_SESSIONS_SHOWN).map(sessionRowHtml).join('');
}
wireLevelPopovers(document.getElementById('sessionsList'));

// ---------- Skill Detail ----------
let currentSkillDetailKey = null;

function renderSkillDetailSessions(key, skillSessions){
  const list = document.getElementById('skdSessionsList');
  const emptyNote = document.getElementById('skdEmptyNote');
  if(skillSessions.length === 0){
    list.style.display = 'none';
    emptyNote.style.display = 'block';
    emptyNote.textContent = 'No sessions yet for ' + skillDisplayLabels[key] + '.';
    return;
  }
  list.style.display = 'flex';
  emptyNote.style.display = 'none';
  // Single-skill filter, so no skill column; every row has range/type detail.
  list.innerHTML = [...skillSessions].reverse().map(s => {
    const info = sessionLevelInfo(s);
    return `<div class="session-row">
      <div class="sr-cell sr-date">${formatSessionDate(s.date)}</div>
      <div class="sr-line2">
        ${levelCellHtml(info)}
        <div class="sr-cell sr-qs">${s.questions || '—'} Qs</div>
        <div class="sr-cell sr-avg">${s.avgTime.toFixed(1)}s avg</div>
        <div class="sr-cell sr-acc">${s.accuracy}% acc</div>
      </div>
      ${levelPopoverHtml(info)}
    </div>`;
  }).join('');
}

function renderSkillDetail(key){
  const skillSessions = sessions.filter(s => s.skill === key);
  const icon = document.getElementById('skdPageTitleIcon');
  icon.textContent = SKILL_ICON[key];
  icon.style.background = 'var(--sk-' + key + '-soft)';
  icon.style.color = 'var(--sk-' + key + ')';
  document.getElementById('skdPageTitleText').textContent = skillDisplayLabels[key];
  document.getElementById('skdTrendDesc').textContent = 'Average answer time per session — ' + skillDisplayLabels[key] + ' only';
  document.getElementById('skdSectionLabel').textContent = 'All sessions — ' + skillDisplayLabels[key];

  renderTrendCard({
    mount: document.getElementById('skdTrend'),
    title: document.getElementById('skdTrendTitle'),
    avg: document.getElementById('skdCurrentAvg'),
    acc: document.getElementById('skdCurrentAcc'),
    growth: document.getElementById('skdGrowth'),
    growthLbl: document.getElementById('skdGrowthLbl')
  }, sessionsToPoints(skillSessions));
  renderSkillDetailSessions(key, skillSessions);
}

function openSkillDetail(key){
  if(!skillDisplayLabels[key]) return;
  currentSkillDetailKey = key;
  renderSkillDetail(key);
  showView('historySkill');
  document.getElementById('view-history-skill').scrollTop = 0;
}
wireLevelPopovers(document.getElementById('skdSessionsList'));
document.getElementById('btnSkdBack').addEventListener('click', () => showView('history'));

// ---------- Full History (paginated) ----------
const FULL_HISTORY_PAGE_SIZE = 15;
let fullHistoryPage = 1;

function pageNumbersToShow(page, total){
  const pages = [];
  const add = (p) => { if(p >= 1 && p <= total && pages.indexOf(p) === -1) pages.push(p); };
  add(1); add(total); add(page - 1); add(page); add(page + 1);
  pages.sort((a,b) => a - b);
  const out = [];
  pages.forEach((p, i) => {
    if(i > 0 && p - pages[i-1] > 1) out.push('...');
    out.push(p);
  });
  return out;
}

function renderFullPagination(totalPages){
  const el = document.getElementById('fullPagination');
  if(totalPages <= 1){ el.innerHTML = ''; return; }
  const chevL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  const chevR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
  let html = `<button class="page-btn page-nav-btn" id="fullBtnPrev"${fullHistoryPage === 1 ? ' disabled' : ''}>${chevL} Prev</button>`;
  pageNumbersToShow(fullHistoryPage, totalPages).forEach(p => {
    if(p === '...') html += '<span class="page-ellipsis">…</span>';
    else html += `<button class="page-btn${p === fullHistoryPage ? ' active' : ''}" data-page="${p}">${p}</button>`;
  });
  html += `<button class="page-btn page-nav-btn" id="fullBtnNext"${fullHistoryPage === totalPages ? ' disabled' : ''}>Next ${chevR}</button>`;
  el.innerHTML = html;
}

function renderFullHistory(){
  const list = document.getElementById('fullSessionsList');
  const countNote = document.getElementById('fullCountNote');
  const emptyState = document.getElementById('fullEmptyState');
  const pagination = document.getElementById('fullPagination');

  if(sessions.length === 0){
    list.style.display = 'none';
    countNote.style.display = 'none';
    pagination.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  list.style.display = 'flex';
  countNote.style.display = 'block';
  emptyState.style.display = 'none';

  const all = [...sessions].reverse(); // newest first
  const totalPages = Math.max(1, Math.ceil(all.length / FULL_HISTORY_PAGE_SIZE));
  fullHistoryPage = Math.min(Math.max(1, fullHistoryPage), totalPages);
  countNote.innerHTML = `<b>${all.length}</b> session${all.length === 1 ? '' : 's'} total`;

  const start = (fullHistoryPage - 1) * FULL_HISTORY_PAGE_SIZE;
  list.innerHTML = all.slice(start, start + FULL_HISTORY_PAGE_SIZE).map(sessionRowHtml).join('');
  renderFullPagination(totalPages);
}

function openFullHistory(){
  fullHistoryPage = 1;
  renderFullHistory();
  showView('historyFull');
  document.getElementById('view-history-full').scrollTop = 0;
}

document.getElementById('fullPagination').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if(!btn || btn.disabled) return;
  if(btn.id === 'fullBtnPrev') fullHistoryPage--;
  else if(btn.id === 'fullBtnNext') fullHistoryPage++;
  else if(btn.dataset.page) fullHistoryPage = parseInt(btn.dataset.page, 10);
  else return;
  renderFullHistory();
  document.getElementById('view-history-full').scrollTop = 0;
});
wireLevelPopovers(document.getElementById('fullSessionsList'));
document.getElementById('btnFullBack').addEventListener('click', () => showView('history'));
document.getElementById('btnSeeFullHistory').addEventListener('click', openFullHistory);

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
wireTooltipBtn('btnSkdExport', 'tipSkdExport');
wireTooltipBtn('btnSkdImport', 'tipSkdImport');

// Export/import always covers ALL sessions (not just the skill being viewed).
function exportHistory(){
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
      const merged = sessions.concat(imported.filter(s => !existingDates.has(s.date)));
      merged.sort((a,b) => a.date - b.date);
      sessions = merged;
      saveSessions(sessions);
      renderHistory();
      // Import can be triggered from Skill Detail too — refresh it if it's the visible screen.
      if(views.historySkill.classList.contains('active') && currentSkillDetailKey) renderSkillDetail(currentSkillDetailKey);
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
