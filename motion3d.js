/* ══════════════════════════════════════════════════
   motion3d.js — shared plumbing for the site's three.js scenes

   · when a scene may load: fine pointer, no reduced-motion preference,
     element (nearly) visible, browser idle
   · one session-wide pause switch (WCAG 2.2.2): every button with
     [data-motion-toggle] flips it and reflects it via aria-pressed
   · colours read from the CSS design tokens
══════════════════════════════════════════════════ */

export const motionAllowed = () =>
  window.matchMedia('(pointer: fine)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function whenVisibleAndIdle(el) {
  return new Promise(resolve => {
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout: 2500 });
      else setTimeout(resolve, 400);
    }, { rootMargin: '200px 0px' });
    io.observe(el);
  });
}

const PAUSE_KEY = 'vs-3d-paused';

export const motionPaused = {
  get() {
    try { return sessionStorage.getItem(PAUSE_KEY) === '1'; } catch { return false; }
  },
  set(paused) {
    try { sessionStorage.setItem(PAUSE_KEY, paused ? '1' : '0'); } catch { /* storage blocked: lasts for this page */ }
    window.dispatchEvent(new CustomEvent('motionpause', { detail: { paused } }));
  },
};

/* Each scene reveals its own button once it's live; all buttons share state. */
export function showPauseButton(button) {
  if (!button) return;
  button.hidden = false;
  button.setAttribute('aria-pressed', String(motionPaused.get()));
}

window.addEventListener('motionpause', ({ detail }) => {
  document.querySelectorAll('[data-motion-toggle]').forEach(b => b.setAttribute('aria-pressed', String(detail.paused)));
});

document.addEventListener('click', e => {
  if (e.target.closest('[data-motion-toggle]')) motionPaused.set(!motionPaused.get());
});

export function tokens(el = document.documentElement) {
  const css = getComputedStyle(el);
  const t = name => css.getPropertyValue(name).trim();
  return {
    bg: t('--bg'), accent: t('--accent'), accent2: t('--accent-hover'),
    text: t('--text'), text2: t('--text-2'), text3: t('--text-3'), danger: t('--danger'),
  };
}
