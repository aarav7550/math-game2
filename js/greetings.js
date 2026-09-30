// ============================================================
// GREETINGS — the only file you need to edit to change them.
//
// HOW TO EDIT
//  - Add a greeting: put a new line inside the right list, in quotes, ending with a comma.
//  - Remove one: delete its line.
//  - Keep them SHORT (about 3 words fits best on a phone screen).
//  - If a greeting contains an apostrophe, wrap it in double quotes: "Let's go"
//
// The lists:
//  morning   -> 5am to 12pm
//  afternoon -> 12pm to 5pm
//  evening   -> 5pm to 9pm
//  night     -> 9pm to 5am
//  anytime   -> mixed in with whichever time-of-day list is active
// ============================================================

const GREETING_MESSAGES = {
  morning: [
    'Good morning',
    'Rise and shine',
    'Early bird mode',
    'Brain: booting up',
    'Coffee first, maths next',
    'Fresh mind, fresh numbers'
  ],
  afternoon: [
    'Good afternoon',
    'Post-lunch brain, activate',
    'Ready to go fast',
    'Afternoon sprint time',
    'Beat the slump',
    'Snack, then speed'
  ],
  evening: [
    'Good evening',
    'Evening warm-up',
    "Let's beat yesterday",
    'One quick round?',
    'Day ending, skills rising',
    'Finish the day strong'
  ],
  night: [
    'Burning the midnight oil',
    'Night owl mode',
    'Still sharp',
    'Sleep is overrated. Almost.',
    'Late-night brain gains',
    'Quiet hours, fast hands'
  ],
  anytime: [
    'Maths hates you back',
    'Numbers are scared of you',
    'Small rounds, big gains',
    'CAT is watching. Nervously.',
    'Speed is a habit',
    "You've got this",
    'Faster than yesterday',
    'Just one round',
    'Make it a streak',
    'Tiny steps, huge score',
    'Hate it? Do it anyway.',
    'Ready when you are'
  ]
};

// Picks one greeting. Called once per page load from ui.js.
function pickGreeting(){
  const h = new Date().getHours();
  const bucket = h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';
  const pool = (GREETING_MESSAGES[bucket] || []).concat(GREETING_MESSAGES.anytime || []);
  if(!pool.length) return 'Hello';
  return pool[Math.floor(Math.random() * pool.length)];
}
