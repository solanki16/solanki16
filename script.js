/* ══════════════════════════════════════════════════
   script.js — home page only
   Active nav · Contact clipboard (the 3D hero lives in hero3d.js)
   (shared behaviour lives in site.js)
══════════════════════════════════════════════════ */

/* ── SCROLL REVEAL (home-specific elements) ──────── */
SITE.reveal([
  '.now-strip', '.section-head', '.section-lead', '.work-row',
  '.research-item', '.post-row', '.about-photo', '.about-body',
  '.tl-item', '.contact-inner'
].join(','));

/* ── ACTIVE NAV LINK ─────────────────────────────── */
// Highlights the in-page nav link whose section crosses the middle of the
// viewport (works for sections of any height).
const navAs = document.querySelectorAll('.nav-links a');
const sectionObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    navAs.forEach(a => a.classList.remove('active'));
    document.querySelector(`.nav-links a[href="#${e.target.id}"]`)?.classList.add('active');
  });
}, { rootMargin: '-50% 0px -50% 0px' });
document.querySelectorAll('main section[id]').forEach(s => sectionObs.observe(s));

/* ── COPY EMAIL TO CLIPBOARD ─────────────────────── */
const copyBtn = document.getElementById('copyEmail');
if (copyBtn) {
  const label = copyBtn.querySelector('span');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('solankyvasu@gmail.com');
      copyBtn.classList.add('copied');
      label.textContent = 'Copied ✓';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        label.textContent = 'Copy address';
      }, 2000);
    } catch {
      location.href = 'mailto:solankyvasu@gmail.com';
    }
  });
}
