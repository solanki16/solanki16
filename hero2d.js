/* ══════════════════════════════════════════════════
   hero2d.js — the hero lattice for touch screens, without three.js

   Where hero3d.js doesn't run (coarse pointers), the same lattice from
   lattice.js turns slowly on a 2D canvas: edges are drawn into a small
   intensity buffer (ROWS cells tall, the poster's density), ordered-dithered
   (Bayer 4×4) in the accent ink, and scaled up with crisp pixels. Same camera, fog and
   starting angle as the poster, so it picks up where the poster left off.
   Capped at 30 fps; stops off-screen, in hidden tabs and when paused. With
   reduced motion the poster stays and this never starts.
══════════════════════════════════════════════════ */

import { whenVisibleAndIdle, motionPaused, showPauseButton, tokens } from './motion3d.js';
import { START_T, lattice, rotate } from './lattice.js';

const hero = document.querySelector('.hero');
const field = document.querySelector('.hero-field');
const canvas = document.getElementById('heroCanvas');
const pauseBtn = document.querySelector('.hero-pause');
const ROWS = 210;
const FOCAL = 1 / Math.tan((20 * Math.PI) / 180); // 40° vertical field of view
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

const coarse = !window.matchMedia('(pointer: fine)').matches;
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (hero && field && canvas && pauseBtn && coarse && !still) whenVisibleAndIdle(field).then(start);

function start() {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { nodes, edges } = lattice();
  let W = 1, H = 1, buf = new Float32Array(1), img = ctx.createImageData(1, 1), ink = [0, 0, 0];

  const resize = () => {
    const r = field.getBoundingClientRect();
    if (!r.width || !r.height) return;
    H = ROWS;
    W = Math.ceil((r.width / r.height) * ROWS);
    canvas.width = W;
    canvas.height = H;
    buf = new Float32Array(W * H);
    img = ctx.createImageData(W, H);
    draw();
  };

  const applyTheme = () => {
    const hex = tokens().accent.replace('#', '');
    ink = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    if (!running) draw();
  };

  const add = (x, y, v) => {
    const i = Math.floor(y) * W + Math.floor(x);
    if (x >= 0 && y >= 0 && x < W && y < H) buf[i] += v;
  };

  let t = START_T;
  function draw() {
    buf.fill(0);
    const rotY = t * 0.14, rotX = Math.sin(t * 0.23) * 0.18;
    const P = nodes.map(n => {
      const [x, y, z] = rotate(n.p, rotY, rotX);
      const d = 7 - z;
      return [W / 2 + ((x * FOCAL) / d) * (H / 2), H / 2 - ((y * FOCAL) / d) * (H / 2), Math.min(1, Math.max(0, (9.2 - d) / 4.2))];
    });
    for (const [a, b] of edges) {
      const A = P[a], B = P[b];
      const steps = Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]));
      for (let s = 0; s <= steps; s++) {
        const u = steps ? s / steps : 0;
        add(A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, 0.3 * (A[2] + (B[2] - A[2]) * u));
      }
    }
    for (const p of P) add(p[0], p[1], 0.9 * p[2]);
    const px = img.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, o = i * 4;
        const on = buf[i] * 2.6 > BAYER[(y & 3) * 4 + (x & 3)];
        px[o] = ink[0];
        px[o + 1] = ink[1];
        px[o + 2] = ink[2];
        px[o + 3] = on ? 255 : 0;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  let running = false, raf = 0, last = 0, acc = 0;
  const frame = now => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    acc += dt;
    if (acc >= 1 / 30) {
      t += acc;
      acc = 0;
      draw();
    }
    raf = requestAnimationFrame(frame);
  };

  let onScreen = true;
  const update = () => {
    const shouldRun = onScreen && !motionPaused.get() && !document.hidden;
    if (shouldRun && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
    hero.dataset.state = running ? 'running' : motionPaused.get() ? 'paused' : 'idle';
  };

  new ResizeObserver(resize).observe(field);
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); }).observe(field);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('motionpause', update);
  window.addEventListener('themechange', applyTheme);

  applyTheme();
  resize();
  showPauseButton(pauseBtn);
  hero.classList.add('is-live');
  update();
}
