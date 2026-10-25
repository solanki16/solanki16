/* ══════════════════════════════════════════════════
   hero3d.js — the home hero's dithered crystal lattice (three.js, on demand)

   The lattice from lattice.js, with data packets doing random walks along its
   edges and a pulsing "shortest vector", is rendered in greyscale into a
   buffer a third of the hero's size, then an ordered (Bayer 4×4) dither pass
   draws it in the accent ink, one 3px cell at a time. Near the pointer the
   lattice densifies (the "decrypt lens"). The dithered poster
   (assets/hero-poster.png, drawn from the same lattice at START_T) is the
   default; three.js is only imported when motion3d.js allows it. Rendering
   stops off-screen, in hidden tabs, and when the shared pause switch is on.
══════════════════════════════════════════════════ */

import { motionAllowed, whenVisibleAndIdle, motionPaused, showPauseButton, tokens } from './motion3d.js';
import { START_T, lattice, seeded } from './lattice.js';

const hero = document.querySelector('.hero');
const field = document.querySelector('.hero-field');
const canvas = document.getElementById('heroCanvas');
const pauseBtn = document.querySelector('.hero-pause');
const CELL = 3; // CSS px per dither cell

if (hero && field && canvas && pauseBtn && motionAllowed()) {
  whenVisibleAndIdle(field)
    .then(() => import('three'))
    .then(start)
    .catch(() => { /* network or WebGL failure: the poster stays */ });
}

const DITHER_FRAG = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec2 uTarget;
  uniform float uCell;
  uniform vec3 uInk;
  uniform float uGain;
  uniform vec2 uPointer;
  uniform float uLens;
  uniform float uRadius;
  float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
  void main() {
    vec2 cell = floor(gl_FragCoord.xy / uCell);
    float v = texture2D(tScene, (cell + 0.5) / uTarget).r * uGain;
    float d = distance((cell + 0.5) * uCell, uPointer);
    v *= 1.0 + uLens * 1.8 * (1.0 - smoothstep(0.0, uRadius, d));
    if (v <= bayer4(cell) + 0.03125) discard;
    gl_FragColor = vec4(uInk, 1.0);
  }
`;
const DITHER_VERT = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

function start(THREE) {
  const dpr = Math.min(window.devicePixelRatio, 2);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(dpr);
  const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, depthBuffer: true });
  target.texture.minFilter = target.texture.magFilter = THREE.NearestFilter;

  // Greyscale scene: everything adds light onto black, the dither pass inks it.
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 5, 9.2);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 0, 7);
  const crystal = new THREE.Group();
  scene.add(crystal);

  const { nodes: raw, edges, neighbours, index } = lattice();
  const nodes = raw.map(n => new THREE.Vector3(...n.p));
  const points = list => {
    const arr = new Float32Array(list.length * 3);
    list.forEach((v, i) => v.toArray(arr, i * 3));
    return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(arr, 3));
  };
  const mat = (Kind, opts) => new Kind({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...opts });
  // three.js sizes points against the canvas, not the (CELL × dpr smaller)
  // buffer they are drawn into, so point sizes are scaled down to match.
  const px = 1 / (CELL * dpr);
  const lineMat = mat(THREE.LineBasicMaterial, { opacity: 0.3 });
  const vectorMat = mat(THREE.LineBasicMaterial, { opacity: 0.55 });
  crystal.add(new THREE.LineSegments(points(edges.flatMap(([a, b]) => [nodes[a], nodes[b]])), lineMat));
  crystal.add(new THREE.Points(points(nodes), mat(THREE.PointsMaterial, { size: 0.055 * px, opacity: 0.9 })));

  // "Shortest vector": from the origin to a nearby lattice point.
  const origin = nodes[index.get('0,0,0')];
  const tip = nodes[index.get('1,-1,1') ?? index.get('1,0,0')];
  crystal.add(new THREE.Line(points([origin, tip]), vectorMat));
  crystal.add(new THREE.Points(points([origin, tip]), mat(THREE.PointsMaterial, { size: 0.17 * px })));

  // Packets walking the edges (seeded, so the layout is the same every visit).
  const random = seeded(7);
  const packets = Array.from({ length: 26 }, () => {
    const a = Math.floor(random() * nodes.length);
    const options = neighbours[a].length ? neighbours[a] : [a];
    return { a, b: options[Math.floor(random() * options.length)], t: random(), speed: 0.9 + random() * 0.9 };
  });
  const packetPos = new Float32Array(packets.length * 3);
  const packetGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(packetPos, 3));
  crystal.add(new THREE.Points(packetGeo, mat(THREE.PointsMaterial, { size: 0.12 * px })));

  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.3, 2), mat(THREE.MeshBasicMaterial, { wireframe: true, opacity: 0.06 }));
  scene.add(shell);

  const scratch = new THREE.Vector3();
  const stepPackets = dt => {
    packets.forEach((p, i) => {
      p.t += dt * p.speed;
      while (p.t >= 1) {
        p.t -= 1;
        const options = neighbours[p.b].filter(n => n !== p.a);
        const pool = options.length ? options : neighbours[p.b];
        p.a = p.b;
        p.b = pool[Math.floor(random() * pool.length)] ?? p.a;
      }
      const s = p.t * p.t * (3 - 2 * p.t);
      scratch.copy(nodes[p.a]).lerp(nodes[p.b], s).toArray(packetPos, i * 3);
    });
    packetGeo.attributes.position.needsUpdate = true;
  };

  // Dither pass.
  const uniforms = {
    tScene: { value: target.texture },
    uTarget: { value: new THREE.Vector2(1, 1) },
    uCell: { value: CELL * dpr },
    uInk: { value: new THREE.Color() },
    uGain: { value: 2 },
    uPointer: { value: new THREE.Vector2(-1e4, -1e4) },
    uLens: { value: 0 },
    uRadius: { value: 170 * dpr },
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms, vertexShader: DITHER_VERT, fragmentShader: DITHER_FRAG, depthTest: false, depthWrite: false,
  }));
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const draw = () => {
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(quadScene, quadCamera);
  };

  let running = false;
  const applyTheme = () => {
    // The dither pass writes the ink as-is (no colour-space conversion in the
    // shader), so keep the token's sRGB values raw.
    uniforms.uInk.value.setStyle(tokens().accent, THREE.LinearSRGBColorSpace);
    if (!running) draw();
  };

  let width = 1, height = 1;
  const resize = () => {
    const r = field.getBoundingClientRect();
    if (!r.width || !r.height) return;
    width = r.width;
    height = r.height;
    renderer.setSize(width, height, false);
    const tw = Math.ceil(width / CELL), th = Math.ceil(height / CELL);
    target.setSize(tw, th);
    uniforms.uTarget.value.set(tw, th);
    uniforms.uCell.value = (width * dpr) / tw;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!running) draw();
  };

  // Pointer: camera parallax, plus the lens that densifies the lattice.
  let targetX = 0, targetY = 0, lensTarget = 0;
  hero.addEventListener('pointermove', e => {
    const r = field.getBoundingClientRect();
    targetX = ((e.clientX - r.left) / r.width - 0.5) * 2;
    targetY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    uniforms.uPointer.value.set((e.clientX - r.left) * dpr, (r.bottom - e.clientY) * dpr);
    lensTarget = 1;
  });
  hero.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; lensTarget = 0; });

  let t = START_T, last = 0, raf = 0;
  const frame = now => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;
    crystal.rotation.y = t * 0.14;
    crystal.rotation.x = Math.sin(t * 0.23) * 0.18;
    shell.rotation.y = -t * 0.05;
    stepPackets(dt);
    vectorMat.opacity = 0.55 + 0.45 * Math.sin((t - START_T) * 2.2);
    camera.position.x += (targetX * 0.9 - camera.position.x) * 0.05;
    camera.position.y += (-targetY * 0.6 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);
    uniforms.uLens.value += (lensTarget - uniforms.uLens.value) * 0.08;
    draw();
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

  crystal.rotation.y = t * 0.14;
  crystal.rotation.x = Math.sin(t * 0.23) * 0.18;
  new ResizeObserver(resize).observe(field);
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); }).observe(field);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('motionpause', update);
  window.addEventListener('themechange', applyTheme);

  stepPackets(0);
  applyTheme();
  resize();
  showPauseButton(pauseBtn);
  hero.classList.add('is-live');
  update();
}
