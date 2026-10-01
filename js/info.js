// ============================================================
// INFO.JS — About us + Report a bug pages (static, no data)
//
// Wires the two 3-dot menu entries to their screens, and makes the Discord /
// Telegram cards try the app first, then fall back to the website if the app
// didn't open (so it works on phones with the app and on desktops without).
// Loaded after challengedetails.js, before popups.js / nav.js.
// ============================================================
(function(){
  document.getElementById('btnAboutUs').addEventListener('click', () => showView('about'));
  document.getElementById('btnReportBug').addEventListener('click', () => showView('bug'));

  // deepLink opens the installed app; if the page never loses focus within 900ms
  // (= no app took over), open the normal web link in a new tab instead.
  function openWithFallback(el, deepLink, fallbackUrl){
    el.addEventListener('click', (e) => {
      e.preventDefault();
      let opened = false;
      const t = setTimeout(() => { if(!opened) window.open(fallbackUrl, '_blank'); }, 900);
      window.addEventListener('blur', function onBlur(){
        opened = true;
        clearTimeout(t);
        window.removeEventListener('blur', onBlur);
      });
      window.location.href = deepLink;
    });
  }
  openWithFallback(document.getElementById('discordLink'), 'discord://discordapp.com/users/aarav73', 'https://discordapp.com/users/aarav73');
  openWithFallback(document.getElementById('telegramLink'), 'tg://resolve?domain=aarav7350', 'https://t.me/aarav7350');
})();
