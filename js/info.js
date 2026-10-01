// ============================================================
// INFO.JS — About us + Report a bug pages
//
// Wires the two 3-dot menu entries to their screens, and sends the Report a bug form
// to Web3Forms (a third-party service that emails each report to the app owner).
// Loaded after challengedetails.js, before popups.js / nav.js.
// ============================================================
(function(){
  document.getElementById('btnAboutUs').addEventListener('click', () => showView('about'));

  // ---------- Report a bug form ----------
  // The access key is meant to be public: it can only deliver mail to the address it was created for.
  const WEB3FORMS_KEY = '0b3ec341-90d7-44e4-86e6-a3b541093fd3';
  const WEB3FORMS_URL = 'https://api.web3forms.com/submit';

  const bugView  = document.getElementById('view-bug');
  const form     = document.getElementById('bugForm');
  const sendBtn  = document.getElementById('bugSend');
  const statusEl = document.getElementById('bugStatus');

  function setStatus(kind, text){
    statusEl.className = 'bug-status' + (kind ? ' ' + kind : '');
    statusEl.textContent = text || '';
  }

  // the message box grows as the text gets long (CSS min-height is its starting size)
  const msgBox = document.getElementById('bugMessage');
  function growMessageBox(){
    msgBox.style.height = 'auto';
    msgBox.style.height = (msgBox.scrollHeight + msgBox.offsetHeight - msgBox.clientHeight) + 'px';   // + border
  }
  msgBox.addEventListener('input', growMessageBox);

  // opening the page always starts clean (old "Sent" / error message gone)
  document.getElementById('btnReportBug').addEventListener('click', () => {
    setStatus('', '');
    showView('bug');
  });
  // typing again clears the previous result
  form.addEventListener('input', () => { if(statusEl.textContent) setStatus('', ''); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(sendBtn.disabled) return;

    const payload = Object.fromEntries(new FormData(form).entries());   // name, email, message, botcheck (only if a bot ticked it)
    payload.access_key = WEB3FORMS_KEY;
    payload.subject = 'Numbers app: bug report';
    payload.from_name = 'Numbers app';

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';
    setStatus('', '');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try{
      const res = await fetch(WEB3FORMS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      const data = await res.json().catch(() => ({}));
      if(res.ok && data.success){
        form.reset();
        growMessageBox();   // reset() doesn't fire an input event, so shrink the box back by hand
        setStatus('ok', 'Sent! Thanks for the report.');
      } else {
        setStatus('err', "Couldn't send your report. Please try again in a moment.");
      }
    }catch(err){
      setStatus('err', navigator.onLine
        ? "Couldn't reach the server. Your text is still here, so try again in a moment."
        : "You seem to be offline. Your text is still here, so try again once you're connected.");
    }finally{
      clearTimeout(timer);
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send report';
    }
  });

  // Phone keyboard: scroll the focused field into view smoothly (same shared helper as Create / Enter Code)
  bugView.addEventListener('focusin', (e) => {
    const f = e.target;
    if(!f.matches('input[type="text"], input[type="email"], textarea')) return;
    if(window.innerWidth > 640 || typeof window.keepFieldClearOfKeyboard !== 'function') return;
    window.keepFieldClearOfKeyboard(bugView, f);
  });
})();
