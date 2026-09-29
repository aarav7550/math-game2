// ============================================================
// NAV.JS — system Back button / swipe-back support (Android + iOS, browser + installed PWA)
//
// Problem this fixes: the app is one page that swaps "views" with showView(), so the
// browser's history never changed and the system Back button left the whole app.
//
// How it works: browser history entries mirror app screens.
//   [sentinel] -> [home] -> [history] -> [skill detail] ...
// - Opening a screen pushes an entry; system Back pops it and we show the previous screen.
// - Back while a popup is open (difficulty picker, exit confirm, name editor, challenge
//   popups, ⋮ menu) closes the popup only.
// - Back during a running round opens the "Leave this round?" confirm instead of quitting.
// - Back on Home (nothing open) steps onto the sentinel entry and exits the app, as expected.
// Loaded LAST (after ui.js / history.js) so it can wrap showView().
// ============================================================
(function(){
  const rawShowView = showView;      // original from skills.js
  let currentView = 'home';
  let depth = 0;                     // screens stacked above Home (Home = 0)
  let exiting = false;

  function stateFor(view, d){ return { app:'numbers', v:view, d:d }; }

  // ---- popups that Back should close first (top-most first) ----
  function closeTopPopup(){
    const dropdown = document.getElementById('moreMenuDropdown');
    if(dropdown && dropdown.classList.contains('open')){ dropdown.classList.remove('open'); return true; }
    const nameOv = document.getElementById('nameOverlay');
    if(nameOv && nameOv.classList.contains('show')){ closeNameEditor(); return true; }
    const exitOv = document.getElementById('exitModal');
    if(exitOv && exitOv.classList.contains('show')){ document.getElementById('btnCancelExit').click(); return true; }
    const diffOv = document.getElementById('diffModalOverlay');
    if(diffOv && diffOv.classList.contains('show')){ closeDifficultyPicker(); return true; }
    for(const id of ['mixedSoonModal','challengeShowModal','challengeEnterModal','settingsModal']){
      const el = document.getElementById(id);
      if(el && el.classList.contains('show')){ el.classList.remove('show'); return true; }
    }
    return false;
  }

  // ---- screen switching wrapper ----
  function viewEl(name){
    return document.getElementById('view-' + (name === 'historySkill' ? 'history-skill' : name === 'historyFull' ? 'history-full' : name));
  }

  // Page-change animation: the screen that just appeared slides/fades in (see .anim-* in style.css).
  //   'fwd'  = going deeper (Home -> History -> Skill Detail): slides in from the right
  //   'back' = going back / to Home: slides in from the left
  //   'fade' = Play <-> Results, where a slide would fight with the answer box getting focus
  // The class is removed and re-added each time so the animation replays on every visit.
  function animateIn(name, dir){
    const v = viewEl(name);
    if(!v) return;
    v.classList.remove('anim-fwd', 'anim-back', 'anim-fade');
    void v.offsetWidth; // force reflow so the same class can replay
    v.classList.add('anim-' + dir);
  }

  function afterShow(name, dir){
    if(name === 'home' && typeof renderHomeDashboard === 'function') renderHomeDashboard(); // stats refresh after a round / import
    const v = viewEl(name);
    if(v) v.scrollTop = 0;
    animateIn(name, dir);
  }

  window.showView = function(name){
    const prev = currentView;
    rawShowView(name);
    currentView = name;
    const isRoundSwap = (prev === 'play' && name === 'results') || (prev === 'results' && name === 'play');
    afterShow(name, name === prev ? 'fade' : isRoundSwap ? 'fade' : name === 'home' ? 'back' : 'fwd');
    if(name === prev) return;

    if(name === 'home'){
      // jump straight back to the Home history entry, however deep we were
      if(depth > 0){ const d = depth; depth = 0; history.go(-d); }
      return;
    }
    // play <-> results swap in place (Back from Results should go Home, not to a finished round)
    if((prev === 'play' && name === 'results') || (prev === 'results' && name === 'play')){
      history.replaceState(stateFor(name, depth), '');
      return;
    }
    depth += 1;
    history.pushState(stateFor(name, depth), '');
  };

  // ---- Back handling ----
  window.addEventListener('popstate', (e) => {
    if(exiting) return;
    const st = e.state;

    // Compensating push keeps the user "on the same screen" when Back was only meant to close something.
    const stay = () => history.pushState(stateFor(currentView, depth), '');

    if(closeTopPopup()){ stay(); return; }

    if(currentView === 'play' && typeof state !== 'undefined' && state.running){
      document.getElementById('btnExitRound').click();   // opens the Leave-round confirm
      stay();
      return;
    }

    if(!st || !st.app){
      // sentinel reached from Home: leave the app
      exiting = true;
      history.back();
      setTimeout(() => { exiting = false; history.pushState(stateFor('home', 0), ''); currentView = 'home'; depth = 0; }, 250);
      return;
    }

    depth = st.d;
    if(st.v !== currentView){
      rawShowView(st.v);
      currentView = st.v;
      afterShow(st.v, 'back');
      // views rendered on open need fresh data if things changed while away
      if(st.v === 'history' && typeof renderHistory === 'function') renderHistory();
    }
  });

  // ---- in-app back buttons go through the same path as the system button ----
  function appBack(){ if(depth > 0) history.back(); else window.showView('home'); }
  ['btnHistoryBack','btnSkdBack','btnFullBack'].forEach(id => {
    const b = document.getElementById(id);
    if(b) b.addEventListener('click', appBack);
  });

  // ---- initial entries: [sentinel] then [home] ----
  try{
    history.replaceState({ sentinel:true }, '');
    history.pushState(stateFor('home', 0), '');
  }catch(e){}
})();
