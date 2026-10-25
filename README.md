# Vasu Solanky — Portfolio

Personal site of Vasu Solanky, B.Tech CSE (Data Science) at Amity University, class of 2027.

## Stack

Static HTML, CSS and vanilla JavaScript: no framework, no build step. three.js 0.185.1 (CDN, pinned with SRI) draws the hero lattice and the three project scenes; the dev tooling in `package.json` only generates assets and runs the quality gate.

## Pages

| Page | What's on it |
|---|---|
| `index.html` | Hero, selected work (three projects with live scenes), experience, about, contact |
| `projects.html` | The three projects as cards |
| `projects/*.html` | One brief per project: what it does, how it's built, result |
| `404.html` | Not-found page (GitHub Pages serves it for any missing URL) |
| `resume.pdf` | The résumé linked from the nav, hero and footer |

## Shared code

- `site.js`: theme, nav, mobile menu, scroll reveal, footer year (every page)
- `script.js`: home page only (decrypt intro, contact copy button)
- `hero3d.js`, `scenes3d.js`, `motion3d.js`: the 3D hero and work-row scenes, loaded when idle, never on touch or with reduced motion, and pausable
- `style.css`: the one stylesheet

## Generated assets

| Command | Writes |
|---|---|
| `npm run gen:marks` | `assets/marks/*.svg` (VS monogram, project glyphs), `favicon.svg`, and the inline glyph copies |
| `npm run gen:poster` | the dithered hero poster, inlined into `style.css` |
| `npm run gen:grain` | the grain texture |
| `npm run gen:og` | `assets/og-image.png`, the social card |
| `npm run set:url -- https://…/` | canonical/og:url tags, absolute og:image, `sitemap.xml` and the robots.txt Sitemap line, once the site has an address |

## Run locally

```bash
npm ci
npm run serve
```

## Quality gate

`npm run check:ratchet` runs HTML/CSS lint, shared-chrome drift, link check, axe, WebKit/Firefox console checks and Lighthouse, and fails on any regression against `.quality/baseline.json`. `npm run check:final` requires every check to pass outright.

## Deploy

GitHub Pages from `main` (keep `.nojekyll`). Then run `npm run set:url` with the final address and commit the result. See `OWNER-TODO.md` for what's still needed from Vasu.
