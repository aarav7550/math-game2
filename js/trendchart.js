// ============================================================
// TRENDCHART.JS — shared avg-time/accuracy trend chart module
// Used by: Home dashboard's history card, History Overview's trend card
// (Step 4: History Skill Detail also reuses this, filtered to one skill)
//
// TrendChart.mount(container, sessionPoints) draws into `container` from
// sessionPoints: [{ ts, val, acc }, ...] (ts = Date.now()-style timestamp,
// val = avg time in seconds, acc = accuracy 0-100). Only points within the
// last 30 days are plotted. Returns { pts } (pts sorted oldest -> newest,
// each { x, label, val, acc }) or null if there was nothing to plot.
// ============================================================
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
    // Group sessions by calendar day and average val/acc within each day — one
    // point per day on the graph, not one point per session played that day.
    const byDay = new Map(); // daysAgo -> {valSum, accSum, count}
    (sessionPoints || []).forEach(s => {
      const daysAgo = Math.round((today - dayStart(s.ts)) / DAY_MS);
      if(daysAgo < 0 || daysAgo > WINDOW_DAYS) return;
      const entry = byDay.get(daysAgo) || { valSum: 0, accSum: 0, count: 0 };
      entry.valSum += s.val;
      entry.accSum += s.acc;
      entry.count += 1;
      byDay.set(daysAgo, entry);
    });
    const rows = Array.from(byDay.entries())
      .map(([daysAgo, e]) => ({ daysAgo, val: e.valSum / e.count, acc: e.accSum / e.count }))
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
