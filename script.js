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
    // Build the reverb impulse response immediately after context creation
    buildReverb();
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

/* ── REVERB ENGINE ──────────────────────────────────────────────
   Signal chain for every sound:

     BufferSource ──→ dryGain  (1.0 = 100%) ──────────────────→ Destination
                  ↘→ ConvolverNode → wetGain (0.25 = 25% wet) ↗

   The ConvolverNode uses a synthetically generated impulse response —
   a short burst of exponentially-decaying noise that mimics a small
   reflective room. No external IR file needed.

   Tuning constants:
     REVERB_DURATION  — length of the synthetic IR in seconds
                        shorter = tighter room, longer = bigger space
     REVERB_DECAY     — how fast the IR decays (higher = faster fade)
     REVERB_WET       — wet mix level (0.0 = dry only, 1.0 = fully wet)
                        0.25 = 25% wet, 75% dry — subtle room feel
---------------------------------------------------------------- */

const REVERB_DURATION = 0.4;   // seconds — short room, not a hall
const REVERB_DECAY    = 4.0;   // decay speed — higher = faster, tighter
const REVERB_WET      = 0.25;  // 25% wet mix

/*
  reverbNode is created once after the AudioContext is initialised,
  then reused for every subsequent playBuffer() call.
  We store it at module scope so we don't rebuild it on every click.
*/
let reverbNode = null;

/**
 * Build a synthetic impulse response and load it into a ConvolverNode.
 *
 * An impulse response (IR) is a recording of how a space responds to
 * a single instantaneous sound. We generate one mathematically:
 *   - Fill a stereo buffer with random noise (white noise)
 *   - Apply an exponential decay envelope to each sample
 * The result is a short burst that decays naturally, mimicking room
 * reflections when convolved with a dry signal.
 *
 * Called once from resumeAudio() after the AudioContext is created.
 */
function buildReverb() {
  if (!audioCtx || reverbNode) return; // already built

  const sampleRate  = audioCtx.sampleRate;
  const length      = Math.floor(sampleRate * REVERB_DURATION);
  const irBuffer    = audioCtx.createBuffer(2, length, sampleRate);

  // Fill both channels (left + right) with decaying noise
  for (let channel = 0; channel < 2; channel++) {
    const data = irBuffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      /*
        Math.random() * 2 - 1  →  white noise in range [-1, 1]
        Math.pow(1 - i/length, REVERB_DECAY)  →  exponential decay envelope
        Multiplying them gives a noise burst that starts loud and fades
        to silence — the same shape as a natural room impulse response.
      */
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, REVERB_DECAY);
    }
  }

  reverbNode = audioCtx.createConvolver();
  reverbNode.buffer = irBuffer;
  reverbNode.normalize = true; // normalise IR so volume stays consistent

  // Connect the reverb output to destination via a wet gain node
  // This node is shared — it stays connected permanently
  const wetGain = audioCtx.createGain();
  wetGain.gain.setValueAtTime(REVERB_WET, audioCtx.currentTime);
  reverbNode.connect(wetGain);
  wetGain.connect(audioCtx.destination);
}

/**
 * Play a loaded audio buffer with reverb.
 *
 * Signal chain:
 *   BufferSource → dryGain (100%) → Destination
 *               ↘ reverbNode → wetGain (25%) → Destination
 *
 * A new BufferSource + dryGain is created per playback.
 * The reverbNode and wetGain are shared and stay connected permanently.
 *
 * @param {string} name   - Key in audioBuffers cache
 * @param {number} volume - Dry gain multiplier (0.0 to 1.0)
 */
function playBuffer(name, volume = 1.0) {
  /*
    Do NOT call resumeAudio() here — context management stays
    strictly in the event binding layer to avoid the "all sounds
    at once" bug from AudioContext creation triggering decode callbacks.
  */
  if (!audioCtx || audioCtx.state === 'suspended') return;

  const buffer = audioBuffers[name];
  if (!buffer) return; // still decoding — skip silently

  const source  = audioCtx.createBufferSource();
  const dryGain = audioCtx.createGain();

  source.buffer = buffer;
  dryGain.gain.setValueAtTime(volume, audioCtx.currentTime);

  // Dry path — full volume direct to output
  source.connect(dryGain);
  dryGain.connect(audioCtx.destination);

  // Wet path — into shared reverb node (already connected to wetGain → destination)
  if (reverbNode) {
    source.connect(reverbNode);
  }

  source.start();
}

/**
 * Play the hover sound — active on nav links and side pills only.
 * Not used on image grid cards.
 */
function playHover() {
  playBuffer('hover', 0.4);
}

/**
 * Play the click sound.
 *
 * Two sounds in use:
 *   'cyan' — nav links across the top, side pills, project page nav links
 *   'gold' — everything else (cards, sidebar blocks, buttons, footer)
 *
 * All other colour names ('purp', 'coral', 'dim') route to gold.
 * Their OGG files remain in assets/audio/ui/ for future use.
 *
 * Navigation cut-off note:
 *   The browser tears down AudioContext on page navigation. To let the
 *   sound complete, anchor click handlers use e.preventDefault() + a
 *   short setTimeout before navigating. Keep click-gold.ogg and
 *   click-cyan.ogg trimmed to ~80ms in Reaper — then the 90ms delay
 *   is tight enough to feel instant.
 *
 * @param {string} colour - 'gold' | 'cyan' (others remapped to gold)
 */
function playClick(colour) {
  const sound = (colour === 'cyan') ? 'cyan' : 'gold';
  playBuffer(sound, 1.0);
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

// Nav links — hover sound + click-cyan
// Uses a short navigation delay so the click sound completes before
// the browser navigates away (fixes audio cut-off on link clicks).
[...document.querySelectorAll('.nav-link')].forEach(el => {
  el.addEventListener('mouseenter', () => { resumeAudio(); playHover(); });

  el.addEventListener('click', (e) => {
    const href = el.getAttribute('href');
    // Only delay real page navigations — not hash links or javascript:
    if (href && !href.startsWith('#') && !href.startsWith('javascript')) {
      e.preventDefault();
      resumeAudio();
      playClick('cyan');
      setActiveNav(el);
      // 120ms delay — enough for a short OGG to complete
      setTimeout(() => { window.location.href = href; }, 90);
    } else {
      resumeAudio();
      playClick('cyan');
      setActiveNav(el);
    }
  });
});

// Logo block
const logoBlock = document.querySelector('.nav-logo-block');
if (logoBlock) {
  logoBlock.addEventListener('mouseenter', () => { resumeAudio(); playHover(); });
  logoBlock.addEventListener('click', (e) => {
    const href = logoBlock.getAttribute('href');
    if (href && !href.startsWith('#')) {
      e.preventDefault();
      resumeAudio();
      playClick('gold');
      setTimeout(() => { window.location.href = href; }, 90);
    } else {
      resumeAudio();
      playClick('gold');
    }
  });
}

// LCARS pills
[...document.querySelectorAll('.lp')].forEach(el => {
  const colour = el.classList.contains('lp--cyan')  ? 'cyan'
               : el.classList.contains('lp--purp')  ? 'purp'
               : el.classList.contains('lp--coral') ? 'coral'
               : el.classList.contains('lp--dim')   ? 'dim'
               : 'gold';
  el.addEventListener('mouseenter', () => { resumeAudio(); playHover(); });
  el.addEventListener('click', () => { resumeAudio(); playClick(colour); pulsePill(el); });
  el.addEventListener('touchend', () => { resumeAudio(); playClick(colour); }, { passive: true });
});

// LCARS sidebar blocks
[...document.querySelectorAll('.lb')].forEach(el => {
  el.addEventListener('mouseenter', () => { resumeAudio(); playHover(); });
  el.addEventListener('click', (e) => {
    const href = el.getAttribute('href');
    if (href && !href.startsWith('#')) {
      e.preventDefault();
      resumeAudio();
      playClick('gold');
      pulsePill(el);
      setTimeout(() => { window.location.href = href; }, 90);
    } else {
      resumeAudio();
      playClick('gold');
      pulsePill(el);
    }
  });
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
