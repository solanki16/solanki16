/* ══════════════════════════════════════════════════
   lattice.js — the site's one crystal lattice

   A lattice on a skewed basis (points in a learned feature space), shared
   by the 3D hero, the phone hero, and the build-time mark generator
   (monogram, favicon, project glyphs), so every drawing of it agrees. Plain
   arrays and no DOM: it runs in the browser and in Node.
══════════════════════════════════════════════════ */

export const BASIS = [
  [0.62, 0.08, 0.02],
  [0.12, 0.6, 0.1],
  [0.06, 0.16, 0.62],
];

const DIRS = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/* Points i·b0 + j·b1 + k·b2 for |i|,|j|,|k| ≤ n inside a sphere of the given
   radius, with edges along the basis directions and neighbour lists. */
export function lattice({ radius = 2.05, n = 4, basis = BASIS } = {}) {
  const index = new Map();
  const nodes = [];
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      for (let k = -n; k <= n; k++) {
        const p = [0, 1, 2].map(a => i * basis[0][a] + j * basis[1][a] + k * basis[2][a]);
        if (Math.hypot(...p) > radius) continue;
        index.set(`${i},${j},${k}`, nodes.length);
        nodes.push({ p, ijk: [i, j, k] });
      }
    }
  }
  const edges = [];
  const neighbours = nodes.map(() => []);
  nodes.forEach((node, a) => {
    for (const [di, dj, dk] of DIRS) {
      const b = index.get(`${node.ijk[0] + di},${node.ijk[1] + dj},${node.ijk[2] + dk}`);
      if (b === undefined) continue;
      edges.push([a, b]);
      neighbours[a].push(b);
      neighbours[b].push(a);
    }
  });
  return { nodes, edges, neighbours, index };
}

/* The hero animation's clock starts here, so the poster (drawn at this
   moment) and the first live frame match. */
export const START_T = 3.5;

/* Rotate about y, then x: the same order as three.js Euler 'XYZ'. */
export function rotate([x, y, z], rotY, rotX) {
  const cy = Math.cos(rotY), sy = Math.sin(rotY);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  const cx = Math.cos(rotX), sx = Math.sin(rotX);
  [y, z] = [y * cx - z * sx, y * sx + z * cx];
  return [x, y, z];
}

/* Rotate, then project with a pinhole camera at distance `dist`.
   Returns [x, y, depthScale]; y grows downwards like screen space. */
export function project(p, rotY, rotX, dist = 7) {
  const [x, y, z] = rotate(p, rotY, rotX);
  const f = dist / (dist + z);
  return [x * f, -y * f, f];
}

/* Deterministic randomness: mulberry32, seeded from a number or a string. */
export function seeded(seed) {
  if (typeof seed === 'string') {
    let h = 0x811c9dc5;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
    seed = h >>> 0;
  }
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
