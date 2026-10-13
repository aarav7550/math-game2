/* =====================================================================
   endmessages.js - the short message shown under the title when a round
   finishes (Results screen, and the shared image).

   HOW TO EDIT (no coding needed):
   - Each block below is one accuracy range. "min" = the lowest accuracy (%)
     that range applies to. The first block that fits wins, so keep the
     blocks ordered from highest min to lowest, and keep the last one at 0.
   - To add a message: add a new line inside that block's [ ... ] list.
     Wrap it in quotes and end the line with a comma.
   - To remove a message: delete its line.
   - Write {name} where the player's name should go. On the Results screen,
     if no name is set, a tappable "set a name" button shows there instead
     (same as Home). In the shared image the name is simply left out.
   - Keep at least ONE message in every block, or that range shows nothing.
   - The title above it already says "Flawless round" / "Solid round" /
     "Round complete", so avoid repeating those words here.
   - Confetti is separate (80%+ in game.js).
   ===================================================================== */

const END_MESSAGE_BANDS = [
  { min: 100, messages: [
    "Not one miss. Spotless.",
    "Every answer right, {name}. Hard to do better.",
    "A clean sweep. That was sharp.",
    "100% accuracy. Well earned, {name}."
  ]},
  { min: 90, messages: [
    "Almost perfect. Really sharp.",
    "Excellent work, {name}.",
    "So close to flawless. Great form.",
    "Very strong, {name}. Keep this up."
  ]},
  { min: 80, messages: [
    "Strong accuracy, {name}. Keep it up.",
    "Nicely done. Right on track.",
    "Good form today. Keep going.",
    "A reliable score. Well played, {name}."
  ]},
  { min: 60, messages: [
    "Decent round. A little more care and you are there.",
    "Getting somewhere, {name}. Go again?",
    "Not bad. Check what you missed below.",
    "Steady progress. One more round will help."
  ]},
  { min: 40, messages: [
    "Tough one. Look at the misses and try again.",
    "Keep at it, {name}. Practice mode can help here.",
    "Some of these are tricky. Another go will feel easier.",
    "Every round teaches you something. Try again."
  ]},
  { min: 0, messages: [
    "Rough one, and that is fine. Try an easier level to build up.",
    "Hard day for numbers, {name}. Come back to it.",
    "Slow and steady wins. Try practice mode, no timer.",
    "Everyone starts somewhere. Go again."
  ]}
];

/* ---------------------------------------------------------------------
   Code below picks and shows the message. You do not need to change it.
   --------------------------------------------------------------------- */
(function () {
  var current = null;   // the message of the round on the Results screen (still has {name} in it)

  // Picks a message for this accuracy. With a seed (the round's date) the pick is always the same for
  // that round, so History shows the same message the Results screen did. Without a seed it is random.
  function pickTemplate(accuracy, seed) {
    var acc = Number(accuracy);
    if (isNaN(acc)) acc = 0;
    var list = null;
    for (var i = 0; i < END_MESSAGE_BANDS.length; i++) {
      if (acc >= END_MESSAGE_BANDS[i].min) { list = END_MESSAGE_BANDS[i].messages; break; }
    }
    if (!list || !list.length) return '';
    var s = Number(seed);
    var idx = isNaN(s) ? Math.floor(Math.random() * list.length) : Math.abs(Math.floor(s)) % list.length;
    return list[idx];
  }

  // Message as plain text. No name set: "{name}" is removed together with the comma/space before it.
  function cleanText(template, name) {
    var n = (name || '').trim();
    if (n) return template.replace(/\{name\}/g, n);
    return template.replace(/[,\s]*\{name\}/g, '').replace(/\s+([.!?])/g, '$1');
  }

  function currentName() {
    return (typeof getDisplayName === 'function') ? getDisplayName() : '';
  }

  // Fills #resultsEndMsg. data-share-text holds the plain version, which is what the shared image uses
  // (so the "set a name" button never ends up in the image).
  function render() {
    var el = document.getElementById('resultsEndMsg');
    if (!el) return;
    var name = currentName().trim();
    el.textContent = '';
    if (!current) { el.removeAttribute('data-share-text'); return; }
    el.setAttribute('data-share-text', cleanText(current, name));
    current.split('{name}').forEach(function (part, i) {
      if (i > 0) {
        if (name) {
          el.appendChild(document.createTextNode(name));
        } else {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'res-name-set';
          b.setAttribute('aria-label', 'Set your name');
          b.innerHTML = 'set a name ' + (typeof PENCIL_SVG !== 'undefined' ? PENCIL_SVG : '');
          el.appendChild(b);
        }
      }
      if (part) el.appendChild(document.createTextNode(part));
    });
  }

  // Called by game.js when a round finishes.
  window.showEndMessage = function (accuracy, seed) {
    current = pickTemplate(accuracy, seed);
    render();
  };

  // Called by ui.js after the name is saved: shows the name instead of the "set a name" button.
  window.refreshEndMessage = function () {
    render();
    var view = document.getElementById('view-results');
    if (view && view.classList.contains('active') && typeof window.prepareResultsShare === 'function') window.prepareResultsShare();
  };

  // Plain-text message for a saved round (History share image).
  window.pickEndMessage = function (accuracy, name, seed) {
    return cleanText(pickTemplate(accuracy, seed), name);
  };

  // The "set a name" button opens the same name popup as Home (one listener on the stable parent).
  var host = document.getElementById('resultsEndMsg');
  if (host) host.addEventListener('click', function (e) {
    if (e.target.closest('.res-name-set') && typeof openNameEditor === 'function') openNameEditor();
  });
})();
