/* ================================================================
   JOE HUDSON — PERSONAL PORTFOLIO
   script.js — Global JavaScript
   
   Contents:
     1.  Web Audio engine — all UI sounds synthesised in the browser
     2.  Sound functions — hover tone, click chirp
     3.  Animation helpers — button press, card flash, pill pulse
     4.  Navigation — mobile menu toggle, active link state
     5.  Ambient FX — random sidebar blink, ticker colour pulse
     6.  Event binding — attaches all sounds/animations to elements
   
   No external libraries required — vanilla JS only.
================================================================ */


/* ----------------------------------------------------------------
   1. WEB AUDIO ENGINE
   
   The Web Audio API lets us generate sounds in code rather than
   loading audio files. We create an AudioContext (the engine),
   then build small signal chains to produce each sound.
   
   AudioContext must be created (or resumed) in response to a user
   gesture — browsers block audio until the user has interacted
   with the page. We call ctx.resume() on first interaction.
---------------------------------------------------------------- */

// Create the audio context — the main engine for all sound synthesis
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

/**
 * Resume the AudioContext if the browser has suspended it.
 * Browsers suspend audio until the first user interaction (click/tap).
 * Call this at the start of any function that makes sound.
 */
function resumeAudio() {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/*
  Colour → frequency mapping.
  Each UI colour has its own pitch pair — this gives each zone
  of the interface a distinct sound character, like different
  console panels having different tones.
  
  Frequencies are in Hertz (Hz):
    Low  = deep/warm (gold = warm authority)
    Mid  = clear/neutral
    High = bright/alert (cyan = data/system)
*/
const FREQ_MAP = {
  gold:  [880,  1100],   // warm, resonant
  cyan:  [1200, 1600],   // bright, data-like
  purp:  [600,  800],    // deep, structural
  coral: [700,  950],    // mid-warm, alert
  dim:   [400,  500],    // low, inactive
};


/* ----------------------------------------------------------------
   2. SOUND FUNCTIONS
---------------------------------------------------------------- */

/**
 * Play a single tone.
 * 
 * @param {number} freq      - Frequency in Hz
 * @param {string} type      - Oscillator wave type: 'sine' | 'square' | 'sawtooth' | 'triangle'
 * @param {number} duration  - How long the tone lasts in seconds
 * @param {number} volume    - Peak volume (0.0 to 1.0; keep low to avoid harshness)
 * @param {number} [delay=0] - Seconds before the tone starts (for sequencing)
 */
function playTone(freq, type, duration, volume, delay = 0) {
  const oscillator = audioCtx.createOscillator();
  const gainNode   = audioCtx.createGain();

  // Connect the signal chain: oscillator → gain → output
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  // Set the waveform and pitch
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);

  // Pitch drops slightly over the duration — gives a satisfying "blip" decay
  oscillator.frequency.exponentialRampToValueAtTime(
    freq * 0.85,
    audioCtx.currentTime + delay + duration
  );

  // Volume envelope: silent → peak → silent (attack/decay)
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime + delay);
  gainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + delay + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);

  // Start and stop the oscillator
  oscillator.start(audioCtx.currentTime + delay);
  oscillator.stop(audioCtx.currentTime + delay + duration + 0.05);
}

/**
 * Play a short hover tone — very quiet, high frequency.
 * Called on mouseenter of any interactive element.
 */
function playHover() {
  resumeAudio();
  playTone(1400, 'sine', 0.06, 0.035);
}

/**
 * Play the main click sound — a two-tone chirp plus noise burst.
 * The pitch is determined by the colour zone clicked.
 * 
 * @param {string} colour - One of: 'gold' | 'cyan' | 'purp' | 'coral' | 'dim'
 */
function playClick(colour) {
  resumeAudio();

  const [freq1, freq2] = FREQ_MAP[colour] || [800, 1000];

  // First tone — immediate
  playTone(freq1, 'sine', 0.08, 0.12);

  // Second tone — 50ms later, slightly quieter
  // The two tones together create the LCARS double-chirp character
  playTone(freq2, 'sine', 0.07, 0.09, 0.05);

  // Noise burst — adds a tactile "click" texture on top of the tones
  const bufferSize  = audioCtx.sampleRate * 0.05; // 50ms of noise
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const noiseData   = noiseBuffer.getChannelData(0);

  // Fill the buffer with random values — this is white noise
  for (let i = 0; i < bufferSize; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * 0.05;
  }

  // Band-pass filter shapes the noise to match the click's pitch
  const noiseSource = audioCtx.createBufferSource();
  const bandPass    = audioCtx.createBiquadFilter();
  const noiseGain   = audioCtx.createGain();

  noiseSource.buffer      = noiseBuffer;
  bandPass.type           = 'bandpass';
  bandPass.frequency.value = freq1 * 1.5;

  noiseSource.connect(bandPass);
  bandPass.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);

  noiseGain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
  noiseSource.start();
}


/* ----------------------------------------------------------------
   3. ANIMATION HELPERS
   Each function adds a CSS class that triggers a keyframe animation,
   then removes it so the same element can be animated again.
   
   void el.offsetWidth forces a browser reflow — this resets
   the animation so it can fire again if the element is clicked twice.
---------------------------------------------------------------- */

/**
 * Flash a LCARS pill/block element on click.
 * @param {HTMLElement} el
 */
function pulsePill(el) {
  el.style.filter = 'brightness(2.5)';
  setTimeout(() => { el.style.filter = ''; }, 180);
}

/**
 * Flash a card with a cyan glow border.
 * @param {HTMLElement} el
 */
function flashCard(el) {
  el.classList.remove('is-flashing');
  void el.offsetWidth; // force reflow
  el.classList.add('is-flashing');
  el.addEventListener('animationend', () => el.classList.remove('is-flashing'), { once: true });
}

/**
 * Flash a button on press.
 * @param {HTMLElement} el
 */
function pressButton(el) {
  const cls = el.classList.contains('btn--cyan') ? 'is-pressed' : 'is-pressed';
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

/**
 * Flash a ribbon item on click.
 * @param {HTMLElement} el
 */
function flashRibbonItem(el) {
  el.style.filter = 'brightness(2)';
  setTimeout(() => { el.style.filter = ''; }, 200);
}


/* ----------------------------------------------------------------
   4. NAVIGATION
---------------------------------------------------------------- */

/**
 * Set the active state on a clicked nav link.
 * Removes 'active' from all links, then adds it to the clicked one.
 * @param {HTMLElement} el - The clicked nav link
 */
function setActiveNav(el) {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active', 'is-flashing');
  });
  el.classList.add('active', 'is-flashing');
  el.addEventListener('animationend', () => el.classList.remove('is-flashing'), { once: true });
}

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    // Toggle the menu open/closed
    const isOpen = navLinks.classList.toggle('is-open');

    // Update aria-expanded so screen readers know the state
    navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

    // Animate the hamburger icon into an X when open
    navToggle.classList.toggle('is-open', isOpen);
  });

  // Close the mobile menu if user clicks a link
  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.classList.remove('is-open');
    });
  });
}


/* ----------------------------------------------------------------
   5. AMBIENT FX
   Makes the interface feel "live" — random sidebar blinks,
   subtle ticker highlights. These run on timers in the background.
---------------------------------------------------------------- */

// Gather all interactive LCARS blocks and pills
const sidebarBlocks = document.querySelectorAll('.lb, .lp');

/**
 * Every 1.8 seconds, randomly pick a sidebar block and
 * briefly flash its brightness — like a system running in the background.
 */
if (sidebarBlocks.length > 0) {
  setInterval(() => {
    const randomBlock = sidebarBlocks[Math.floor(Math.random() * sidebarBlocks.length)];
    randomBlock.style.filter = 'brightness(2.2)';
    setTimeout(() => { randomBlock.style.filter = ''; }, 130);
  }, 1800);
}

// Ticker items for ambient colour pulse
const tickerItems = document.querySelectorAll('.ticker-item');

/**
 * Every 3 seconds, randomly highlight a ticker item in cyan
 * for a brief moment — subtle but adds to the "live data" feel.
 */
if (tickerItems.length > 0) {
  setInterval(() => {
    const randomItem = tickerItems[Math.floor(Math.random() * tickerItems.length)];
    const originalColour = randomItem.style.color;
    randomItem.style.color = '#00c8e0';
    setTimeout(() => { randomItem.style.color = originalColour; }, 400);
  }, 3000);
}


/* ----------------------------------------------------------------
   6. EVENT BINDING
   
   Attach sounds and animations to all interactive elements.
   
   We use event delegation where possible — attaching one listener
   to a parent rather than hundreds of listeners to each child.
   This is more efficient and works even for elements added later.
   
   querySelectorAll returns a NodeList — we spread it into an array
   so we can use .forEach() on it cleanly.
---------------------------------------------------------------- */

// Helper — attach hover sound to a list of elements
function bindHover(selector) {
  [...document.querySelectorAll(selector)].forEach(el => {
    el.addEventListener('mouseenter', playHover);
  });
}

// Helper — attach click sound + animation to a list of elements
function bindClick(selector, colour, animFn) {
  [...document.querySelectorAll(selector)].forEach(el => {
    el.addEventListener('click', () => {
      playClick(colour);
      if (animFn) animFn(el);
    });
    el.addEventListener('mouseenter', playHover);
  });
}

// Bind sounds to nav links
[...document.querySelectorAll('.nav-link')].forEach(el => {
  el.addEventListener('mouseenter', playHover);
  el.addEventListener('click', () => {
    playClick('cyan');
    setActiveNav(el);
  });
});

// Logo block
const logoBlock = document.querySelector('.nav-logo-block');
if (logoBlock) {
  logoBlock.addEventListener('mouseenter', playHover);
  logoBlock.addEventListener('click', () => playClick('gold'));
}

// LCARS pills (hero sidebar)
[...document.querySelectorAll('.lp')].forEach(el => {
  const colour = el.classList.contains('lp--cyan')  ? 'cyan'
               : el.classList.contains('lp--purp')  ? 'purp'
               : el.classList.contains('lp--coral') ? 'coral'
               : el.classList.contains('lp--dim')   ? 'dim'
               : 'gold';
  el.addEventListener('mouseenter', playHover);
  el.addEventListener('click', () => { playClick(colour); pulsePill(el); });
});

// LCARS sidebar blocks (main content area)
[...document.querySelectorAll('.lb')].forEach(el => {
  const colour = el.classList.contains('lb--cyan')  ? 'cyan'
               : el.classList.contains('lb--purp')  ? 'purp'
               : el.classList.contains('lb--coral') ? 'coral'
               : el.classList.contains('lb--dim')   ? 'dim'
               : 'gold';
  el.addEventListener('mouseenter', playHover);
  el.addEventListener('click', () => { playClick(colour); pulsePill(el); });
});

// Decorative colour bars (hero right panel)
bindClick('.hrb--gold',  'gold');
bindClick('.hrb--cyan',  'cyan');
bindClick('.hrb--coral', 'coral');

// Readout tab (coral Status button)
const readoutTab = document.querySelector('.readout-tab');
if (readoutTab) {
  readoutTab.addEventListener('mouseenter', playHover);
  readoutTab.addEventListener('click', () => {
    playClick('coral');
    readoutTab.style.filter = 'brightness(1.8)';
    setTimeout(() => { readoutTab.style.filter = ''; }, 250);
  });
}

// Readout stats
[...document.querySelectorAll('.readout-stat')].forEach((el, i) => {
  const colours = ['gold', 'cyan', 'purp', 'coral'];
  const colour  = colours[i % colours.length];
  el.addEventListener('mouseenter', playHover);
  el.addEventListener('click', () => playClick(colour));
});

// Ribbon items
[...document.querySelectorAll('.ribbon-item')].forEach(el => {
  const colour = el.classList.contains('ribbon-item--gold')  ? 'gold'
               : el.classList.contains('ribbon-item--cyan')  ? 'cyan'
               : el.classList.contains('ribbon-item--coral') ? 'coral'
               : 'dim';
  el.addEventListener('mouseenter', playHover);
  el.addEventListener('click', () => { playClick(colour); flashRibbonItem(el); });
});

// Work cards
[...document.querySelectorAll('.card')].forEach((el, i) => {
  const colours = ['gold', 'cyan', 'purp'];
  const colour  = colours[i % colours.length];
  el.addEventListener('mouseenter', playHover);
  el.addEventListener('click', () => { playClick(colour); flashCard(el); });
});

// CTA buttons
const btnCyan = document.querySelector('.btn--cyan');
if (btnCyan) {
  btnCyan.addEventListener('mouseenter', playHover);
  btnCyan.addEventListener('click', () => { playClick('cyan'); pressButton(btnCyan); });
}

const btnGhost = document.querySelector('.btn--ghost');
if (btnGhost) {
  btnGhost.addEventListener('mouseenter', playHover);
  btnGhost.addEventListener('click', () => { playClick('purp'); pressButton(btnGhost); });
}

// Footer elbow
const footerElbow = document.querySelector('.footer-elbow');
if (footerElbow) {
  footerElbow.addEventListener('mouseenter', playHover);
  footerElbow.addEventListener('click', () => playClick('gold'));
}

// Footer links
bindClick('.footer-link', 'cyan');
