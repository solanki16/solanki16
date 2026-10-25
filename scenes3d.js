/* ══════════════════════════════════════════════════
   scenes3d.js — live 3D scenes in the home "Selected work" rows

   Each .term[data-scene] terminal window gets a small scene that illustrates
   the project. One shared, off-screen WebGL renderer draws each visible
   scene and copies the frame into that window's canvas, so the page only
   ever holds one extra WebGL context. Loading, pausing and colours follow
   motion3d.js (the terminal windows keep the dark palette in both themes).
══════════════════════════════════════════════════ */

import { motionAllowed, whenVisibleAndIdle, motionPaused, showPauseButton, tokens } from './motion3d.js';

const figures = [...document.querySelectorAll('.term[data-scene]')]
  .filter(fig => fig.querySelector('.term-scene'));

if (figures.length && motionAllowed() && figures[0].offsetParent !== null) {
  whenVisibleAndIdle(figures[0])
    .then(() => import('three'))
    .then(start)
    .catch(() => { /* network or WebGL failure: the text outline stays */ });
}

function start(THREE) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const dpr = Math.min(window.devicePixelRatio, 2);

  const items = figures.map(fig => {
    const holder = fig.querySelector('.term-scene');
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    holder.append(canvas);
    const built = BUILDERS[fig.dataset.scene](THREE, tokens(fig));
    return { fig, holder, canvas, ctx: canvas.getContext('2d'), visible: false, w: 1, h: 1, ...built };
  });

  // The shared buffer is sized to the largest scene and only grows, so it is
  // never reallocated per frame; each scene renders into its bottom-left corner.
  let bufW = 1, bufH = 1;
  const resize = item => {
    const r = item.holder.getBoundingClientRect();
    if (!r.width || !r.height) return;
    item.w = Math.round(r.width * dpr);
    item.h = Math.round(r.height * dpr);
    item.canvas.width = item.w;
    item.canvas.height = item.h;
    item.camera.aspect = r.width / r.height;
    item.camera.updateProjectionMatrix();
    if (item.w > bufW || item.h > bufH) {
      bufW = Math.max(bufW, item.w);
      bufH = Math.max(bufH, item.h);
      renderer.setSize(bufW, bufH, false);
    }
  };

  const draw = (item, time) => {
    item.update(time);
    renderer.setViewport(0, 0, item.w, item.h);
    renderer.render(item.scene, item.camera);
    item.ctx.clearRect(0, 0, item.w, item.h);
    item.ctx.drawImage(renderer.domElement, 0, bufH - item.h, item.w, item.h, 0, 0, item.w, item.h);
  };

  let t = 0, last = 0, raf = 0, running = false;
  const frame = now => {
    t += Math.min((now - last) / 1000, 0.05);
    last = now;
    for (const item of items) if (item.visible) draw(item, t);
    raf = requestAnimationFrame(frame);
  };

  const update = () => {
    const shouldRun = items.some(i => i.visible) && !motionPaused.get() && !document.hidden;
    if (shouldRun && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };

  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      const item = items.find(i => i.fig === e.target);
      if (item) item.visible = e.isIntersecting;
    }
    update();
  });

  for (const item of items) {
    resize(item);
    draw(item, 0);
    new ResizeObserver(() => { resize(item); if (!running) draw(item, t); }).observe(item.holder);
    io.observe(item.fig);
    item.fig.classList.add('is-live');
    showPauseButton(item.fig.querySelector('.scene-pause'));
  }
  document.addEventListener('visibilitychange', update);
  window.addEventListener('motionpause', update);
}

/* ── Scene builders: each returns { scene, camera, update(t) } ── */

function baseScene(THREE, c, cameraPos) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(new THREE.Color().setStyle(c.bg), 5, 11);
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 50);
  camera.position.set(...cameraPos);
  camera.lookAt(0, 0, 0);
  const color = value => new THREE.Color().setStyle(value);
  return { scene, camera, color };
}

const outline = (THREE, w, h, color, opacity = 1) => new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)),
  new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
);
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = x => { const u = clamp01(x); return u * u * (3 - 2 * u); };
// Deterministic "random" in [0, 1) so every visit draws the same scene.
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/* Movie genres: a poster passes through a CNN's feature maps; each genre gets
   its own sigmoid score, and every bar above the threshold is a predicted genre. */
function genres(THREE, c) {
  const { scene, camera, color } = baseScene(THREE, c, [0.5, 1.1, 6.4]);
  const group = new THREE.Group();
  group.scale.setScalar(1.18);
  scene.add(group);

  const poster = outline(THREE, 1.0, 1.45, color(c.text2));
  poster.position.x = -2.3;
  group.add(poster);
  const pixels = Array.from({ length: 36 }, (_, i) =>
    new THREE.Vector3(-2.3 + (hash(i) - 0.5) * 0.8, (hash(i + 50) - 0.5) * 1.25, 0));
  group.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(pixels),
    new THREE.PointsMaterial({ color: color(c.text3), size: 0.06 })));

  // Three convolution blocks: feature maps shrink and multiply.
  const maps = [];
  [[-1.1, 1.0, 3], [-0.25, 0.7, 4], [0.45, 0.45, 5]].forEach(([x, size, depth]) => {
    for (let k = 0; k < depth; k++) {
      const m = outline(THREE, size, size, color(c.accent), 0.35);
      m.position.set(x + k * 0.07, k * 0.04, -k * 0.12);
      group.add(m);
      maps.push({ m, x });
    }
  });

  // Output: one bar per genre, an independent sigmoid each, and the 0.5 threshold.
  const N = 5, base = -0.85, full = 1.7, x0 = 1.35, gap = 0.3;
  const barGeo = new THREE.BoxGeometry(0.16, 1, 0.16).translate(0, 0.5, 0);
  const bars = Array.from({ length: N }, (_, i) => {
    const mesh = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: color(c.text3) }));
    mesh.position.set(x0 + i * gap, base, 0);
    group.add(mesh);
    return mesh;
  });
  const thresholdGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x0 - 0.2, base + full / 2, 0), new THREE.Vector3(x0 + (N - 1) * gap + 0.2, base + full / 2, 0)]);
  const threshold = new THREE.Line(thresholdGeo, new THREE.LineDashedMaterial({ color: color(c.text2), dashSize: 0.08, gapSize: 0.06 }));
  threshold.computeLineDistances();
  group.add(threshold);

  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), new THREE.MeshBasicMaterial({ color: color(c.accent2), transparent: true }));
  group.add(pulse);

  const P = 4.5;
  const score = (n, i) => 1 / (1 + Math.exp(-3.2 * Math.sin(n * 1.7 + i * 2.3 + i * i * 0.4)));
  const on = color(c.accent), off = color(c.text3);
  return {
    scene, camera,
    update(t) {
      group.rotation.y = Math.sin(t * 0.3) * 0.3 - 0.12;
      const n = Math.floor(t / P), u = (t / P) % 1;
      const travel = smooth(u / 0.6);
      const px = -2.3 + travel * (x0 - 0.3 + 2.3);
      pulse.position.set(px, 0, 0.05);
      pulse.material.opacity = u < 0.62 ? 1 : 0;
      for (const { m, x } of maps) m.material.opacity = 0.3 + 0.7 * Math.exp(-((px - x) ** 2) / 0.08);
      const mix = smooth((u - 0.58) / 0.3);
      bars.forEach((bar, i) => {
        const s = score(n - 1, i) + (score(n, i) - score(n - 1, i)) * mix;
        bar.scale.y = Math.max(0.02, s) * full;
        bar.material.color.copy(s > 0.5 ? on : off);
      });
    },
  };
}

/* Meeting summarizer: transcript lines stream into the model; a short summary
   and a checklist of action items come out the other side. */
function meeting(THREE, c) {
  const { scene, camera, color } = baseScene(THREE, c, [0.3, 1.0, 6.4]);
  const group = new THREE.Group();
  scene.add(group);

  // Transcript: a column of lines scrolling up through a window.
  const frame = outline(THREE, 1.4, 2.6, color(c.text3), 0.8);
  frame.position.x = -2.0;
  group.add(frame);
  const L = 15, step = 0.17, top = 1.15;
  const linePos = new Float32Array(L * 6), lineCol = new Float32Array(L * 6);
  const lineGeo = new THREE.BufferGeometry()
    .setAttribute('position', new THREE.BufferAttribute(linePos, 3))
    .setAttribute('color', new THREE.BufferAttribute(lineCol, 3));
  group.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true })));
  const ink = color(c.text2), bg = color(c.bg), tmp = new THREE.Color();

  const model = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.42)),
    new THREE.LineBasicMaterial({ color: color(c.accent) }));
  group.add(model);

  const dotGeo = new THREE.SphereGeometry(0.05, 10, 10);
  const dots = Array.from({ length: 8 }, (_, i) => {
    const mesh = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: color(i < 5 ? c.text2 : c.accent2) }));
    group.add(mesh);
    return { mesh, phase: i / 5, out: i >= 5, y: (hash(i) - 0.5) * 2 };
  });

  // Summary (three lines) and action items (three checkboxes).
  const sumFrame = outline(THREE, 1.5, 0.75, color(c.text3), 0.8);
  sumFrame.position.set(1.95, 0.7, 0);
  group.add(sumFrame);
  const growLine = (x, y, len, col) => {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(len, 0, 0)]),
      new THREE.LineBasicMaterial({ color: color(col) }));
    line.position.set(x, y, 0);
    group.add(line);
    return line;
  };
  const summary = [1.15, 0.95, 0.7].map((len, i) => growLine(1.33, 0.9 - i * 0.2, len, c.text));
  const tasks = [0, 1, 2].map(i => {
    const y = -0.25 - i * 0.38;
    const box = outline(THREE, 0.18, 0.18, color(c.accent));
    box.position.set(1.3, y, 0);
    group.add(box);
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({ color: color(c.accent) }));
    tick.position.set(1.3, y, 0);
    group.add(tick);
    return { tick, line: growLine(1.5, y, [0.95, 1.1, 0.75][i], c.text2) };
  });

  const P = 6;
  return {
    scene, camera,
    update(t) {
      group.rotation.y = Math.sin(t * 0.28) * 0.3 - 0.1;
      model.rotation.x = t * 0.5;
      model.rotation.y = t * 0.35;
      for (let i = 0; i < L; i++) {
        const y = -top + ((i * step + t * 0.28) % (L * step));
        const len = 0.45 + hash(i + Math.floor((i * step + t * 0.28) / (L * step)) * L) * 0.65;
        const fade = Math.min(1, (top - Math.abs(y)) / 0.3);
        linePos.set([-2.55, y, 0, -2.55 + len, y, 0], i * 6);
        tmp.copy(bg).lerp(ink, clamp01(fade)).toArray(lineCol, i * 6);
        tmp.toArray(lineCol, i * 6 + 3);
      }
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.color.needsUpdate = true;
      for (const d of dots) {
        const u = (t * 0.45 + d.phase) % 1;
        if (d.out) d.mesh.position.set(0.45 + u * 0.8, (d.y > 0 ? 0.7 : -0.6) * smooth(u), 0);
        else d.mesh.position.set(-1.25 + u * 0.9, d.y * (1 - u), 0);
        d.mesh.scale.setScalar(Math.sin(u * Math.PI));
      }
      const u = (t / P) % 1;
      const reset = 1 - smooth((u - 0.9) / 0.1);
      summary.forEach((line, i) => { line.scale.x = Math.max(0.001, smooth((u - 0.08 - i * 0.08) / 0.15) * reset); });
      tasks.forEach(({ tick, line }, i) => {
        const k = smooth((u - 0.4 - i * 0.13) / 0.1) * reset;
        line.scale.x = Math.max(0.001, k);
        tick.visible = u > 0.48 + i * 0.13 && u < 0.92;
      });
    },
  };
}

/* Document intelligence: a scan line reads an invoice, OCR boxes land on the
   text, and the fields come out as key/value rows. One field comes back with
   low confidence and is flagged for review. */
function docs(THREE, c) {
  const { scene, camera, color } = baseScene(THREE, c, [0.4, 1.0, 6.4]);
  const group = new THREE.Group();
  group.scale.setScalar(1.22);
  scene.add(group);

  const page = outline(THREE, 1.6, 2.2, color(c.text2));
  page.position.x = -1.6;
  group.add(page);
  const rows = Array.from({ length: 10 }, (_, i) => ({ y: 0.85 - i * 0.19, len: 0.5 + hash(i + 7) * 0.75 }));
  const textPts = rows.flatMap(r => [new THREE.Vector3(-2.2, r.y, 0), new THREE.Vector3(-2.2 + r.len, r.y, 0)]);
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(textPts),
    new THREE.LineBasicMaterial({ color: color(c.text3) })));

  const scanGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2.4, 0, 0.02), new THREE.Vector3(-0.8, 0, 0.02)]);
  const scan = new THREE.Line(scanGeo, new THREE.LineBasicMaterial({ color: color(c.accent2), transparent: true }));
  group.add(scan);

  // Five extracted fields; the fourth is the low-confidence one.
  const FLAG = 3;
  const fields = [0, 2, 4, 6, 8].map((r, i) => {
    const { y, len } = rows[r];
    const col = color(i === FLAG ? c.danger : c.accent);
    const box = outline(THREE, len + 0.12, 0.15, col, 0);
    box.position.set(-2.2 + len / 2, y, 0.01);
    group.add(box);
    const row = new THREE.Group();
    const ry = 0.8 - i * 0.4;
    const key = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.45, 0, 0)]),
      new THREE.LineBasicMaterial({ color: color(c.text3), transparent: true }));
    const val = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.6, 0, 0), new THREE.Vector3(0.6 + 0.4 + hash(i) * 0.6, 0, 0)]),
      new THREE.LineBasicMaterial({ color: col, transparent: true }));
    row.add(key, val);
    let flag = null;
    if (i === FLAG) {
      flag = outline(THREE, 0.14, 0.14, col);
      flag.position.set(1.85, 0, 0);
      row.add(flag);
    }
    row.position.set(0.3, ry, 0);
    group.add(row);
    return { y, box, row, mats: [key.material, val.material, ...(flag ? [flag.material] : [])], flag };
  });

  const P = 6;
  return {
    scene, camera,
    update(t) {
      group.rotation.y = Math.sin(t * 0.25) * 0.3 - 0.15;
      const u = (t / P) % 1;
      const sy = 1.0 - smooth(u / 0.6) * 2.0;
      scan.position.y = sy;
      scan.material.opacity = u < 0.62 ? 1 : 0;
      const reset = 1 - smooth((u - 0.88) / 0.1);
      fields.forEach(({ y, box, row, mats, flag }, i) => {
        const seen = u < 0.62 ? smooth((y - sy) / 0.12) : 1;
        box.material.opacity = seen * reset;
        const k = smooth((u - (0.1 + (1 - (y + 1) / 2) * 0.55) - 0.05) / 0.12) * reset;
        row.position.x = 0.3 - (1 - k) * 0.4;
        for (const m of mats) m.opacity = k;
        if (flag) flag.material.opacity = k * (0.55 + 0.45 * Math.sin(t * 6));
        if (i === FLAG) box.material.opacity *= 0.55 + 0.45 * Math.sin(t * 6);
      });
    },
  };
}

const BUILDERS = { genres, meeting, docs };
