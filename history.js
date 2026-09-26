// ============================================================
// HISTORY.JS — history view, per-skill stats, export/import
// ============================================================

// ---------- history view ----------
const skillLabels = { half:'Halving', x2:'× 2', x3:'× 3', add:'Additions', mixed:'Mixed' };

// One-line range/count summary for a single session's saved config, shown on its history row.
// Mixed rounds list each included skill's range on its own line.
function describeSessionConfig(s){
  if(!s.config || !s.config.cfg) return '';
  if(s.skill === 'mixed'){
    const included = s.config.included || Object.keys(s.config.cfg);
    return included.map(k => describeSkillConfig(k, s.config.cfg[k])).join(' · ');
  }
  return describeSkillConfig(s.skill, s.config.cfg);
}

// Difficulty + range string for one skill's config, e.g. "Easy (100–299)" or
// "Custom (1–999, 3 nums)" for addition.
function rangeStr(key, cfg){
  if(!cfg) return '';
  const diff = difficultyLabels[matchingDifficultyForConfig(key, cfg)];
  const detail = key === 'add' ? `${cfg.min}–${cfg.max}, ${cfg.count || 2} nums` : `${cfg.min}–${cfg.max}`;
  return `${diff} (${detail})`;
}

// For the per-skill summary: if every session used the exact same difficulty/range (and
// count, for addition), show it; otherwise say it varies rather than trying to combine them.
function summarizeRangeAcrossSessions(key, list){
  const getCfg = (s) => s.skill === 'mixed' ? (s.config?.cfg?.[key]) : s.config?.cfg;
  const strs = list.map(s => rangeStr(key, getCfg(s))).filter(Boolean);
  if(strs.length === 0) return '';
  const allSame = strs.every(s => s === strs[0]);
  return allSame ? strs[0] : 'difficulty varies';
}

// 'all' shows every session on the chart; otherwise filters the chart + count to one skill.
// This is chart/count display only — the per-skill improvement summary below always covers all skills.
let historySkillFilter = 'all';

function buildSkillFilterSeg(){
  const seg = document.getElementById('skillFilterSeg');
  const present = Array.from(new Set(sessions.map(s => s.skill)));
  if(present.length <= 1){
    seg.style.display = 'none';
    return;
  }
  seg.style.display = 'flex';
  seg.innerHTML = '';
  const options = [['all','All']].concat(present.map(k => [k, skillLabels[k] || k]));
  options.forEach(([key,label]) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.dataset.key = key;
    if(key === historySkillFilter) btn.classList.add('active');
    seg.appendChild(btn);
  });
}
document.getElementById('skillFilterSeg').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if(!btn) return;
  historySkillFilter = btn.dataset.key;
  renderHistory();
});

function renderHistory(){
  const list = document.getElementById('sessionsList');
  const svg = document.getElementById('chartSvg');
  const emptyChartNote = document.getElementById('emptyChartNote');
  const chartTitle = document.getElementById('chartTitle');
  list.innerHTML = '';
  svg.innerHTML = '';

  if(sessions.length === 0){
    list.innerHTML = '<div class="empty-state">No rounds played yet. Finish a round to see your progress here.</div>';
    emptyChartNote.style.display = 'block';
    emptyChartNote.textContent = 'Play a round to see your trend here.';
    document.getElementById('skillFilterSeg').style.display = 'none';
    document.getElementById('perSkillStatsList').innerHTML = '';
    return;
  }

  buildSkillFilterSeg();
  renderPerSkillStats();

  const filtered = historySkillFilter === 'all' ? sessions : sessions.filter(s => s.skill === historySkillFilter);
  chartTitle.textContent = historySkillFilter === 'all'
    ? 'Average answer time per round (seconds)'
    : `Average answer time — ${skillLabels[historySkillFilter] || historySkillFilter} (seconds)`;

  const recent = filtered.slice(-15);

  if(recent.length === 0){
    emptyChartNote.style.display = 'block';
    emptyChartNote.textContent = 'No rounds for this skill yet.';
  } else if(recent.length < 2){
    emptyChartNote.style.display = 'block';
    emptyChartNote.textContent = 'Play a couple more rounds to see a trend line here.';
  } else {
    emptyChartNote.style.display = 'none';
  }
  if(recent.length === 0) return;

  // read live theme colors so the chart matches light/dark mode
  const styles = getComputedStyle(document.documentElement);
  const colAccent = styles.getPropertyValue('--accent').trim() || '#F4B740';
  const colBorder = styles.getPropertyValue('--border').trim() || '#262B33';
  const colTextDim = styles.getPropertyValue('--text-dim').trim() || '#7C838F';
  const colBg = styles.getPropertyValue('--bg-raised').trim() || '#1B1F26';

  const ns = 'http://www.w3.org/2000/svg';
  const W = 640, H = 240;
  const PAD_L = 42, PAD_R = 16, PAD_T = 14, PAD_B = 34;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const times = recent.map(s => s.avgTime);
  const rawMax = Math.max(...times);
  const maxT = rawMax <= 0 ? 1 : Math.ceil(rawMax * 1.2 * 2) / 2; // round up to nearest 0.5
  const minT = 0;

  const stepX = recent.length > 1 ? plotW / (recent.length - 1) : 0;
  function xFor(i){ return recent.length === 1 ? PAD_L + plotW/2 : PAD_L + i*stepX; }
  function yFor(t){ return PAD_T + plotH - ((t-minT)/(maxT-minT||1))*plotH; }

  // --- Y axis gridlines + labels (5 ticks) ---
  const TICKS = 5;
  for(let i=0;i<=TICKS;i++){
    const val = (maxT/TICKS)*i;
    const y = yFor(val);

    const gridline = document.createElementNS(ns,'line');
    gridline.setAttribute('x1', PAD_L); gridline.setAttribute('x2', W-PAD_R);
    gridline.setAttribute('y1', y); gridline.setAttribute('y2', y);
    gridline.setAttribute('stroke', colBorder);
    gridline.setAttribute('stroke-width', '1');
    svg.appendChild(gridline);

    const label = document.createElementNS(ns,'text');
    label.setAttribute('x', PAD_L - 8);
    label.setAttribute('y', y + 4);
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('font-size', '11');
    label.textContent = val.toFixed(1) + 's';
    svg.appendChild(label);
  }

  // --- trend line ---
  let path = '';
  recent.forEach((s,i) => {
    const x = xFor(i), y = yFor(s.avgTime);
    path += (i===0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
  });
  const line = document.createElementNS(ns,'path');
  line.setAttribute('d', path.trim());
  line.setAttribute('fill','none');
  line.setAttribute('stroke', colAccent);
  line.setAttribute('stroke-width','2.5');
  line.setAttribute('stroke-linecap','round');
  line.setAttribute('stroke-linejoin','round');
  svg.appendChild(line);

  // --- points + X axis date labels ---
  recent.forEach((s,i) => {
    const x = xFor(i), y = yFor(s.avgTime);
    const dot = document.createElementNS(ns,'circle');
    dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', 4);
    dot.setAttribute('fill', colBg);
    dot.setAttribute('stroke', colAccent);
    dot.setAttribute('stroke-width','2');
    svg.appendChild(dot);

    // show every label if few points, otherwise thin them out to avoid overlap
    const showLabel = recent.length <= 8 || i === 0 || i === recent.length-1 || i % Math.ceil(recent.length/6) === 0;
    if(showLabel){
      const d = new Date(s.date);
      const label = document.createElementNS(ns,'text');
      label.setAttribute('x', x);
      label.setAttribute('y', H - PAD_B + 18);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '10.5');
      label.textContent = d.toLocaleDateString(undefined, {month:'short', day:'numeric'});
      svg.appendChild(label);
    }
  });

  // --- axis lines (drawn last-ish, under points but over gridlines is fine either order) ---
  const xAxis = document.createElementNS(ns,'line');
  xAxis.setAttribute('x1', PAD_L); xAxis.setAttribute('x2', W-PAD_R);
  xAxis.setAttribute('y1', PAD_T+plotH); xAxis.setAttribute('y2', PAD_T+plotH);
  xAxis.setAttribute('stroke', colTextDim);
  xAxis.setAttribute('stroke-width', '1.2');
  svg.insertBefore(xAxis, svg.firstChild);

  [...filtered].reverse().slice(0,25).forEach(s => {
    const row = document.createElement('div');
    row.className = 'session-row';
    const d = new Date(s.date);
    const dateStr = d.toLocaleDateString(undefined, {month:'short', day:'numeric'}) + ' · ' +
                    d.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});
    row.innerHTML = `
      <div>
        <div class="sr-skill">${skillLabels[s.skill] || s.skill}${s.fromChallenge ? '<span class="practice-badge">Challenge</span>' : ''}</div>
        <div class="sr-date">${dateStr}</div>
        <div class="sr-config">${describeSessionConfig(s)}</div>
      </div>
      <div class="sr-stats">
        <span><b>${s.questions || '—'}</b> Qs</span>
        <span><b>${s.accuracy}%</b> acc</span>
        <span><b>${s.avgTime.toFixed(1)}s</b> avg</span>
        <span><b>${s.bestTime.toFixed(1)}s</b> best</span>
      </div>
    `;
    list.appendChild(row);
  });
}

// ---------- per-skill improvement summary ----------
// Compares each skill's average time on its most recent rounds vs its earlier rounds,
// so "improving" or "slowing down" reflects a real trend, not just the last round.
function renderPerSkillStats(){
  const container = document.getElementById('perSkillStatsList');
  container.innerHTML = '';
  const bySkill = {};
  sessions.forEach(s => {
    if(!bySkill[s.skill]) bySkill[s.skill] = [];
    bySkill[s.skill].push(s);
  });

  Object.keys(bySkill).forEach(key => {
    const list = bySkill[key];
    const n = list.length;
    const avgOverall = list.reduce((a,s)=>a+s.avgTime,0)/n;
    const bestOverall = Math.min(...list.map(s=>s.bestTime));
    const accOverall = Math.round(list.reduce((a,s)=>a+s.accuracy,0)/n);

    let trendText = 'Not enough rounds yet';
    let trendClass = '';
    if(n >= 4){
      const half = Math.floor(n/2);
      const earlier = list.slice(0, half);
      const laterHalf = list.slice(half);
      const earlierAvg = earlier.reduce((a,s)=>a+s.avgTime,0)/earlier.length;
      const laterAvg = laterHalf.reduce((a,s)=>a+s.avgTime,0)/laterHalf.length;
      const diff = earlierAvg - laterAvg; // positive = getting faster
      const pct = Math.abs(diff/earlierAvg*100);
      if(pct < 3){
        trendText = 'Holding steady';
      } else if(diff > 0){
        trendText = `${pct.toFixed(0)}% faster recently`;
        trendClass = 'good';
      } else {
        trendText = `${pct.toFixed(0)}% slower recently`;
      }
    }

    const rangeSummary = key === 'mixed' ? '' : summarizeRangeAcrossSessions(key, list);

    const row = document.createElement('div');
    row.className = 'skill-stat-row';
    row.innerHTML = `
      <span class="ssr-name">${skillLabels[key] || key}</span>
      <span class="ssr-nums">
        <span><b>${n}</b> rounds</span>
        <span><b>${accOverall}%</b> acc</span>
        <span><b>${avgOverall.toFixed(1)}s</b> avg</span>
        <span><b>${bestOverall.toFixed(1)}s</b> best</span>
        <span style="${trendClass==='good' ? 'color:var(--good);' : ''}"><b>${trendText}</b></span>
      </span>
      ${rangeSummary ? `<div class="ssr-range">${rangeSummary}</div>` : ''}
    `;
    container.appendChild(row);
  });

  if(Object.keys(bySkill).length === 0){
    container.innerHTML = '<div class="empty-state">No rounds played yet.</div>';
  }
}

// ---------- export / import ----------
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
