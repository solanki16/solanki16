/* ══════════════════════════════════════════════════
   site.js — shared across all pages
   Theme · Nav · Mobile menu · Reveal · Footer year
══════════════════════════════════════════════════ */

(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── THEME TOGGLE ──────────────────────────────── */
  // The inline <head> script sets data-theme before first paint; this keeps
  // the button in sync, saves an explicit choice, follows the system setting
  // until the visitor picks one, and tells canvases to recolour (themechange).
  const root = document.documentElement;
  const themeBtn = document.getElementById('themeToggle');
  const systemLight = window.matchMedia('(prefers-color-scheme: light)');
  const savedTheme = () => {
    try { return localStorage.getItem('theme'); } catch { return null; }
  };
  function applyTheme(theme, save) {
    root.dataset.theme = theme;
    if (themeBtn) themeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    if (save) {
      try { localStorage.setItem('theme', theme); } catch { /* storage blocked: theme lasts for this page only */ }
    }
    // Canvases recolour after the new theme has painted, keeping the click's
    // own frame (and INP) light.
    requestAnimationFrame(() => setTimeout(() => {
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }));
  }
  applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark', false);
  if (themeBtn) {
    themeBtn.addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true));
  }
  systemLight.addEventListener('change', e => {
    if (!savedTheme()) applyTheme(e.matches ? 'light' : 'dark', false);
  });

  /* ── NAV SCROLLED STATE ────────────────────────── */
  const nav = document.getElementById('nav');
  if (nav && !nav.hasAttribute('data-solid')) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── HAMBURGER / MOBILE MENU ───────────────────── */
  // Closed: invisible and inert. Open: everything outside the nav and the menu
  // is inert, focus moves into the menu, Escape closes it and returns focus.
  const hamburger = document.getElementById('hamburger');
  const mobMenu   = document.getElementById('mobMenu');
  if (hamburger && mobMenu) {
    hamburger.setAttribute('aria-controls', 'mobMenu');
    hamburger.setAttribute('aria-expanded', 'false');
    mobMenu.inert = true;
    const outside = () => [...document.body.children].filter(el =>
      el !== mobMenu && !el.contains(hamburger) && el.tagName !== 'SCRIPT');

    const setMenu = (open, returnFocus = false) => {
      hamburger.classList.toggle('open', open);
      mobMenu.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', String(open));
      hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
      mobMenu.inert = !open;
      outside().forEach(el => { el.inert = open; });
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) mobMenu.querySelector('a')?.focus();
      else if (returnFocus) hamburger.focus();
    };

    hamburger.addEventListener('click', () => setMenu(!mobMenu.classList.contains('open')));
    mobMenu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && mobMenu.classList.contains('open')) setMenu(false, true);
    });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', e => { if (e.matches) setMenu(false); });
  }

  /* ── SCROLL REVEAL ─────────────────────────────── */
  // Content is visible without JS. Otherwise, unless reduced motion is on:
  //  - 'css': scroll-driven animations (html.reveal-sda) do the work in CSS
  //  - 'js':  html.reveal-on hides pending .reveal elements until they reach
  //           the viewport; a rAF scroll check (not IntersectionObserver) also
  //           catches elements that were jumped past by anchors or fast scrolls
  const revealMode = reducedMotion ? 'none'
    : (window.CSS && CSS.supports('animation-timeline: view()')) ? 'css' : 'js';
  const pending = new Set();
  let revealQueued = false;
  function revealInView() {
    revealQueued = false;
    const limit = window.innerHeight - 40;
    for (const el of pending) {
      if (el.getBoundingClientRect().top < limit) {
        el.classList.add('visible');
        pending.delete(el);
      }
    }
  }
  function queueReveal() {
    if (!revealQueued && pending.size) {
      revealQueued = true;
      requestAnimationFrame(revealInView);
    }
  }
  function reveal(selector) {
    document.querySelectorAll(selector).forEach((el, i) => {
      if (el.classList.contains('reveal')) return;
      el.classList.add('reveal');
      el.style.setProperty('--d', (i % 5) * 70 + 'ms');
      if (revealMode === 'js') pending.add(el);
      else el.classList.add('visible');
    });
    queueReveal();
  }
  if (revealMode === 'css') document.documentElement.classList.add('reveal-sda');
  if (revealMode === 'js') {
    document.documentElement.classList.add('reveal-on');
    window.addEventListener('scroll', queueReveal, { passive: true });
    window.addEventListener('resize', queueReveal, { passive: true });
  }
  window.SITE = { reveal };
  reveal('.section-head, .card-grid > li, .footer-inner');

  /* ── DITHERED PORTRAIT ─────────────────────────── */
  // The About photo shows as a dithered print; the toggle (and hover, on
  // fine pointers) shows the original.
  document.querySelectorAll('.photo-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      btn.closest('.about-photo')?.classList.toggle('is-original', on);
    });
  });

  /* ── 3D TILT CARDS ─────────────────────────────── */
  // Cards lean towards the pointer, with title and tags at different depths
  // (see .tilt in style.css). Mouse/trackpad only, never with reduced motion.
  // Game cards tilt gently and flatten while the pointer is over the board.
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer && !reducedMotion) {
    const MAX = { 'game-card': 3 };
    document.querySelectorAll('.proj-card, .media-card, .hobby-card, .case-pager-link, .game-card').forEach(card => {
      const max = MAX[[...card.classList].find(c => c in MAX)] ?? 7;
      let frame = 0, px = 0, py = 0, flat = false;
      const paint = () => {
        frame = 0;
        const r = card.getBoundingClientRect();
        const x = flat ? 0.5 : (px - r.left) / r.width;
        const y = flat ? 0.5 : (py - r.top) / r.height;
        card.style.setProperty('--ry', ((x - 0.5) * 2 * max).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - y) * 2 * max).toFixed(2) + 'deg');
        card.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
      };
      card.classList.add('tilt');
      card.addEventListener('pointermove', e => {
        px = e.clientX;
        py = e.clientY;
        flat = !!e.target.closest('canvas, input, .doom-mount');
        card.classList.toggle('is-tilting', !flat);
        if (!frame) frame = requestAnimationFrame(paint);
      });
      card.addEventListener('pointerleave', () => {
        cancelAnimationFrame(frame);
        frame = 0;
        card.classList.remove('is-tilting');
        for (const v of ['--rx', '--ry', '--gx', '--gy']) card.style.removeProperty(v);
      });
    });
  }

  /* ── PAGE TRANSITIONS ──────────────────────────── */
  // When a project card or work row opens a case study, name its title so the
  // cross-document View Transition morphs it into the case page's heading.
  window.addEventListener('pageswap', e => {
    const url = e.activation?.entry?.url;
    if (!e.viewTransition || !url || !url.includes('/projects/')) return;
    const link = [...document.querySelectorAll('a[href]')].find(a => a.href === url);
    const title = link?.closest('.proj-card, .work-row')?.querySelector('.proj-card-title, .work-title');
    if (title) title.style.viewTransitionName = 'case-title';
  });

  /* ── FOOTER YEAR ───────────────────────────────── */
  document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
  });
})();
