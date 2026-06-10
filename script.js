/* ================================================================
   JOE HUDSON — PERSONAL PORTFOLIO
   script.js — Global JavaScript

   Contents:
     1.  Web Audio engine — file-based buffer loader
     2.  Sound functions — hover tone, click by colour zone
     3.  Animation helpers — button press, card flash, pill pulse
     4.  Navigation — mobile menu toggle, active link state
     5.  Ambient FX — random sidebar blink, ticker colour pulse
     6.  Event binding — attaches all sounds/animations to elements

   Audio files live in:
     assets/audio/ui/
       hover.ogg          ← plays on mouseenter of any interactive element
       click-gold.ogg     ← gold zone elements (logo, structural borders)
       click-cyan.ogg     ← cyan zone elements (nav links, data readouts)
       click-purp.ogg     ← purple zone elements (role label, cards)
       click-coral.ogg    ← coral zone elements (status tab, alerts)
       click-dim.ogg      ← inactive / dim elements

   Recommended export settings from Reaper:
     Format:      OGG Vorbis (primary) — best Web Audio API support
     Sample rate: 48kHz
     Bit depth:   16-bit (24-bit working files, downconvert on export)
     Loudness:    ~-12 LUFS — leave headroom for the gain stage below
     Length:      hover 50–80ms, clicks 80–150ms
     Silence:     trim tightly both ends — pre-delay makes UI feel laggy

   No external libraries required — vanilla JS only.
================================================================ */


/* ----------------------------------------------------------------
   1. WEB AUDIO ENGINE

   AudioContext is the main engine for all audio playback.
   It must be created (or resumed) after a user gesture —
   browsers block audio until the user has interacted with the page.

   audioBuffers is a cache — each file is decoded once on load and
   stored here so clicks feel instant rather than waiting for a file
   to load on first play.
---------------------------------------------------------------- */

/*
  AudioContext is created lazily — only on the first user gesture.
  Chrome (and most modern browsers) block AudioContext creation until
  the user has interacted with the page. Creating it on page load
  triggers hundreds of "not allowed to start" warnings.

  audioCtx starts as null. The first time resumeAudio() is called
  it creates the context and silently pre-loads all sound files into
  the buffer cache. No sounds play during loading — playback only
  happens when playBuffer() is explicitly called from a hover or click.
*/
let audioCtx     = null;
const audioBuffers = {};
let soundsLoading = false; // prevents loadAllSounds() firing more than once

/**
 * Create the AudioContext on first user gesture, or resume if suspended.
 * Triggers a silent background load of all sound files on first call.
 */
function resumeAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (!soundsLoading) {
      soundsLoading = true;
      // Load files silently in the background — no playback triggered here
      loadAllSounds();
    }
  } else if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/**
 * Load a single audio file and store it in the buffer cache.
 *
 * How it works:
 *   1. fetch() downloads the file as raw bytes
 *   2. arrayBuffer() converts the response to a binary ArrayBuffer
 *   3. decodeAudioData() decodes the OGG into a raw PCM AudioBuffer
 *      that the Web Audio API can play with zero latency
 *
 * @param {string} name - Cache key (e.g. 'hover', 'gold', 'cyan')
 * @param {string} url  - Path to the audio file
 */
async function loadSound(name, url) {
  try {
    const response    = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    /*
      decodeAudioData() decodes the file into a raw PCM AudioBuffer.
      We store it in the cache but do NOT call source.start() here —
      that was causing all sounds to fire simultaneously on first load.
      Playback only happens when playBuffer() is explicitly called
      from a user interaction event (mouseenter / click).
    */
    audioBuffers[name] = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) {
    /*
      If a file isn't found or fails to decode, we log a warning but
      don't crash — the site works fine, just without that sound.
      This means you can deploy before all sounds are designed and
      add them in progressively as each file is ready.
    */
    console.warn(`Audio: could not load "${name}" from ${url}`, err);
  }
}

/**
 * Pre-load all UI sounds when the page initialises.
 *
 * Promise.all() fires all fetches simultaneously rather than
 * one after another — faster total load time.
 *
 * Path note: this script lives at the root level (next to index.html)
 * and is also loaded by pages in /pages/ via ../script.js.
 * We detect which context we're in and build the correct base path.
 */
async function loadAllSounds() {

  /*
    Resolve the correct asset path depending on which page loaded this script:
      index.html  (root)    → base = 'assets/audio/ui/'
      pages/*.html          → base = '../assets/audio/ui/'
  */
  const isSubpage = window.location.pathname.includes('/pages/');
  const base      = isSubpage ? '../assets/audio/ui/' : 'assets/audio/ui/';

  await Promise.all([
    loadSound('hover',  base + 'hover.ogg'),
    loadSound('gold',   base + 'click-gold.ogg'),
    loadSound('cyan',   base + 'click-cyan.ogg'),
    loadSound('purp',   base + 'click-purp.ogg'),
    loadSound('coral',  base + 'click-coral.ogg'),
    loadSound('dim',    base + 'click-dim.ogg'),
  ]);
}

// Sound files are loaded on first user interaction via resumeAudio()
// — see the lazy AudioContext creation at the top of this file.


/* ----------------------------------------------------------------
   2. SOUND FUNCTIONS
---------------------------------------------------------------- */

/**
 * Play a loaded audio buffer.
 *
 * Signal chain:
 *   BufferSource → GainNode → AudioContext destination (speakers)
 *
 * A new BufferSource node is created for each playback — this is
 * correct Web Audio API usage. BufferSources are cheap, designed
 * to be created once, played once, then garbage collected.
 *
 * @param {string} name   - Key in audioBuffers cache
 * @param {number} volume - Gain multiplier (0.0 to 1.0)
 */
function playBuffer(name, volume = 1.0) {
  /*
    Do NOT call resumeAudio() here — that creates the AudioContext and
    triggers loadAllSounds(). If resumeAudio() were called from inside
    playBuffer, every decoded buffer completion would re-enter here and
    fire all cached sounds simultaneously (the "all sounds at once" bug).

    resumeAudio() is called only from the event binding layer below.
    Context management and playback are strictly separate.
  */
  if (!audioCtx || audioCtx.state === 'suspended') return;

  const buffer = audioBuffers[name];
  if (!buffer) return; // still decoding — skip silently

  const source = audioCtx.createBufferSource();
  const gain   = audioCtx.createGain();

  source.connect(gain);
  gain.connect(audioCtx.destination);

  source.buffer = buffer;
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);

  source.start();
}

/**
 * Hover sound removed — kept as no-op so existing calls don't error.
 * The hover.ogg file remains in assets/audio/ui/ for future use.
 */
function playHover() {
  // intentionally silent
}

/**
 * Play the click sound for a given colour zone.
 * Each colour has its own distinct sound character.
 *
 * @param {string} colour - 'gold' | 'cyan' | 'purp' | 'coral' | 'dim'
 */
function playClick(colour) {
  playBuffer(colour, 1.0);
}


/* ----------------------------------------------------------------
   3. ANIMATION HELPERS
---------------------------------------------------------------- */

/**
 * Briefly flash a LCARS pill or block element on click.
 * @param {HTMLElement} el
 */
function pulsePill(el) {
  el.style.filter = 'brightness(2.5)';
  setTimeout(() => { el.style.filter = ''; }, 180);
}

/**
 * Flash a card with a cyan glow border on click.
 * @param {HTMLElement} el
 */
function flashCard(el) {
  el.classList.remove('is-flashing');
  void el.offsetWidth; // force reflow to re-trigger animation
  el.classList.add('is-flashing');
  el.addEventListener('animationend', () => el.classList.remove('is-flashing'), { once: true });
}

/**
 * Flash a CTA button on press.
 * @param {HTMLElement} el
 */
function pressButton(el) {
  el.classList.remove('is-pressed');
  void el.offsetWidth;
  el.classList.add('is-pressed');
  el.addEventListener('animationend', () => el.classList.remove('is-pressed'), { once: true });
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
    const isOpen = navLinks.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    navToggle.classList.toggle('is-open', isOpen);
  });

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
---------------------------------------------------------------- */

const sidebarBlocks = document.querySelectorAll('.lb, .lp');

if (sidebarBlocks.length > 0) {
  setInterval(() => {
    const el = sidebarBlocks[Math.floor(Math.random() * sidebarBlocks.length)];
    el.style.filter = 'brightness(2.2)';
    setTimeout(() => { el.style.filter = ''; }, 130);
  }, 1800);
}

const tickerItems = document.querySelectorAll('.ticker-item');

if (tickerItems.length > 0) {
  setInterval(() => {
    const el            = tickerItems[Math.floor(Math.random() * tickerItems.length)];
    const originalColor = el.style.color;
    el.style.color = '#00c8e0';
    setTimeout(() => { el.style.color = originalColor; }, 400);
  }, 3000);
}


/* ----------------------------------------------------------------
   6. EVENT BINDING
---------------------------------------------------------------- */

// Nav links — click for desktop, touchend for mobile
[...document.querySelectorAll('.nav-link')].forEach(el => {
  function handleNav() { resumeAudio(); playClick('cyan'); setActiveNav(el); }
  el.addEventListener('click',    handleNav);
  el.addEventListener('touchend', handleNav, { passive: true });
});

// Logo block
const logoBlock = document.querySelector('.nav-logo-block');
if (logoBlock) {
  function handleLogo() { resumeAudio(); playClick('gold'); }
  logoBlock.addEventListener('click',    handleLogo);
  logoBlock.addEventListener('touchend', handleLogo, { passive: true });
}

// LCARS pills
[...document.querySelectorAll('.lp')].forEach(el => {
  const colour = el.classList.contains('lp--cyan')  ? 'cyan'
               : el.classList.contains('lp--purp')  ? 'purp'
               : el.classList.contains('lp--coral') ? 'coral'
               : el.classList.contains('lp--dim')   ? 'dim'
               : 'gold';
  el.addEventListener('click', () => { playClick(colour); pulsePill(el); });
});

// LCARS sidebar blocks
[...document.querySelectorAll('.lb')].forEach(el => {
  const colour = el.classList.contains('lb--cyan')  ? 'cyan'
               : el.classList.contains('lb--purp')  ? 'purp'
               : el.classList.contains('lb--coral') ? 'coral'
               : el.classList.contains('lb--dim')   ? 'dim'
               : 'gold';
  el.addEventListener('click', () => { playClick(colour); pulsePill(el); });
});

// Hero right decorative bars
[...document.querySelectorAll('.hrb')].forEach(el => {
  const colour = el.classList.contains('hrb--cyan')  ? 'cyan'
               : el.classList.contains('hrb--coral') ? 'coral'
               : 'gold';
  el.addEventListener('click', () => playClick(colour));
});

// Readout tab
const readoutTab = document.querySelector('.readout-tab');
if (readoutTab) {
  readoutTab.addEventListener('click', () => {
    playClick('coral');
    readoutTab.style.filter = 'brightness(1.8)';
    setTimeout(() => { readoutTab.style.filter = ''; }, 250);
  });
}

// Readout stats
[...document.querySelectorAll('.readout-stat')].forEach((el, i) => {
  const colours = ['gold', 'cyan', 'purp', 'coral'];
  el.addEventListener('click', () => playClick(colours[i % colours.length]));
});

// Ribbon items
[...document.querySelectorAll('.ribbon-item')].forEach(el => {
  const colour = el.classList.contains('ribbon-item--gold')  ? 'gold'
               : el.classList.contains('ribbon-item--cyan')  ? 'cyan'
               : el.classList.contains('ribbon-item--coral') ? 'coral'
               : 'dim';
  el.addEventListener('click', () => { playClick(colour); flashRibbonItem(el); });
});

// Work cards
[...document.querySelectorAll('.card')].forEach((el, i) => {
  const colours = ['gold', 'cyan', 'purp'];
  el.addEventListener('click', () => { playClick(colours[i % colours.length]); flashCard(el); });
});

// CTA buttons — click + touchend for mobile
[...document.querySelectorAll('.btn--cyan')].forEach(el => {
  function handleCyan() { resumeAudio(); playClick('cyan'); pressButton(el); }
  el.addEventListener('click',    handleCyan);
  el.addEventListener('touchend', handleCyan, { passive: true });
});

[...document.querySelectorAll('.btn--ghost')].forEach(el => {
  function handleGhost() { resumeAudio(); playClick('purp'); pressButton(el); }
  el.addEventListener('click',    handleGhost);
  el.addEventListener('touchend', handleGhost, { passive: true });
});

// Footer elbow
const footerElbow = document.querySelector('.footer-elbow');
if (footerElbow) {
  function handleElbow() { resumeAudio(); playClick('gold'); }
  footerElbow.addEventListener('click',    handleElbow);
  footerElbow.addEventListener('touchend', handleElbow, { passive: true });
}

// Footer links
[...document.querySelectorAll('.footer-link')].forEach(el => {
  el.addEventListener('click', () => playClick('cyan'));
});
