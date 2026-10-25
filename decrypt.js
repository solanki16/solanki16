/* ══════════════════════════════════════════════════
   decrypt.js — the hero name "decrypts" once per visit

   A scan sweeps across the name: each letter flickers through ciphertext and
   resolves to itself. The real name is always in the page (the h1's
   accessible text is a visually hidden copy; this animates an aria-hidden
   one), nothing is hidden before it runs, and each letter sits in a cell
   fixed to its final width, so the layout never moves. Skipped with reduced
   motion, after the first run in a session, and on any key or click.
══════════════════════════════════════════════════ */

const KEY = 'vs-decrypted';
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=/<>';
const name = document.querySelector('[data-decrypt]');

const seen = () => {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return true; }
};

if (name && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !seen()) {
  try { sessionStorage.setItem(KEY, '1'); } catch { /* storage blocked: runs once per page */ }
  Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 600))]).then(run);
}

function run() {
  const lines = [...name.querySelectorAll('.hero-line')];
  const original = lines.map(line => line.textContent);
  // Spaces stay plain text: an inline-block cell holding a space measures 0px
  // and would close the word gap for the length of the animation.
  const cells = lines.flatMap(line => {
    const chars = [...line.textContent];
    line.textContent = '';
    return chars.flatMap(ch => {
      if (ch === ' ') {
        line.append(' ');
        return [];
      }
      const span = document.createElement('span');
      span.className = 'decrypt-cell';
      span.textContent = ch;
      line.append(span);
      return [{ span, ch }];
    });
  });
  for (const c of cells) c.width = c.span.getBoundingClientRect().width;
  for (const c of cells) c.span.style.width = `${c.width}px`;

  const STEP = 42, HOLD = 280, LEAD = 220;
  const total = LEAD + cells.length * STEP + HOLD;
  let raf = 0;
  const finish = () => {
    cancelAnimationFrame(raf);
    lines.forEach((line, i) => { line.textContent = original[i]; });
    window.removeEventListener('keydown', finish);
    window.removeEventListener('pointerdown', finish);
  };
  window.addEventListener('keydown', finish, { once: true });
  window.addEventListener('pointerdown', finish, { once: true });

  const t0 = performance.now();
  let lastSwap = 0;
  const frame = now => {
    const t = now - t0;
    if (t >= total) return finish();
    const swap = now - lastSwap > 55;
    if (swap) lastSwap = now;
    cells.forEach((c, i) => {
      const startAt = LEAD + i * STEP;
      const scrambling = t >= startAt && t < startAt + HOLD;
      if (scrambling && swap) c.span.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      else if (!scrambling && c.span.textContent !== c.ch) c.span.textContent = c.ch;
      c.span.classList.toggle('is-cipher', scrambling);
    });
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
