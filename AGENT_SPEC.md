# AR Image-Tracking Web App — Build Spec

> Audience: an autonomous coding agent (Antigravity). Read this whole file before doing anything.
> Owner's priorities, in order: **(1) fast load on mobile data, (2) drag-and-drop tracking-image workflow, (3) clean, professional look.**

---

## 1. Goal

Build a mobile-first WebAR app. A visitor opens a URL, taps **Start**, points their phone camera at a printed or on-screen image, and the app overlays content on it: 3D models, video, images, and text, in any mix per image.

The developer adds a new trackable image by **dropping the image file into a folder**. A script compiles all images into a single MindAR `.mind` file and generates a manifest. No manual use of MindAR's online compiler, and no hard-coded target indexes.

Library: **MindAR-JS** (image tracking). Docs: https://hiukim.github.io/mind-ar-js-doc/

---

## 2. Decisions already made

The owner was unsure about the stack and asked for the option that loads fastest while still looking professional. Use this stack. Do not switch without asking.

| Concern | Choice | Why |
|---|---|---|
| Build tool | **Vite** | Fast dev server, code-splitting, hashed assets, simple plugin API |
| Language | **Vanilla TypeScript** (no UI framework) | The UI is a handful of screens. React or Vue would add weight with no benefit |
| 3D | **Three.js** (tree-shaken named imports) | Lighter and more controllable than A-Frame, which adds a large runtime and abstraction layer |
| AR | **MindAR image tracking, Three.js build** (`mind-ar` on npm) | The official integration for Three.js |
| Styling | Plain CSS with custom-property tokens | No CSS framework |
| Hosting target | Any static host with HTTPS and a CDN (Cloudflare Pages, Netlify, Vercel, GitHub Pages) | Camera access requires HTTPS |

**Not allowed without asking:** A-Frame, React/Vue/Svelte, Tailwind, UI kits, jQuery, Google Fonts CDN links (self-host any font).

---

## 3. How to work

1. **Do not trust memory for MindAR's API.** The docs are sparse on bundler usage and the offline compiler. After `npm install`, read the installed package (`node_modules/mind-ar`: `package.json`, `dist/`, `src/`) and treat it as the source of truth. Confirm the exports, constructor options, and compatible `three` version before designing around them. Pin exact versions.
2. **Start with a spike (Phase 0)** that proves the riskiest parts work before you build architecture: MindAR + Three.js under Vite with one hard-coded target, and compiling a `.mind` file from the command line. Report what you found.
3. **Write an implementation plan first** and pause for my approval. Include the file tree, dependency list with justifications, and any deviations from this spec.
4. **Work in the phases in section 11.** After each phase, run the acceptance checks, summarize the results, and stop for my review before starting the next phase.
5. **Ask rather than guess** on product questions. Section 12 lists what I expect you to ask up front.
6. **Keep dependencies minimal.** Justify each one in the plan. Prefer small, well-maintained packages.
7. Camera-based AR can't be fully verified in your browser. Build the preview and debug modes in section 9 so you can verify rendering without a camera, and clearly list what only I can verify on a real phone.

---

## 4. Drag-and-drop tracking pipeline (core feature)

### Folder layout

```
targets/                  <- DROP TRACKING IMAGES HERE (.jpg .jpeg .png)
  spring-poster.jpg
  business-card.png
content/
  experiences.json        <- what to show for each target (see section 5)
  assets/                 <- GLB, video, image files referenced by experiences.json
```

The **filename stem is the target's ID** (`spring-poster`). IDs must be unique and slug-safe. Warn on collisions or unsafe names.

### Behavior

- A script (`tools/compile-targets`) reads every image in `targets/`, **sorts them alphabetically for a deterministic order**, compiles them into **one** `.mind` file, and writes a manifest.
- It runs automatically on `npm run dev` (with a watcher), `npm run build`, and manually via `npm run targets`.
- **Dev experience:** while `npm run dev` is running, dropping, replacing, or deleting an image in `targets/` recompiles automatically and reloads the page. Implement this as a small local Vite plugin. Use the Vite dev server's file watcher and a `full-reload` message. Expose the manifest to app code as a virtual module (for example `virtual:ar-targets`).
- **Incremental caching:** compiling is slow. Hash each image plus the compiler version and skip recompiling when nothing changed. Show progress in the terminal.
- **Output:**
  - `targets.<contenthash>.mind`. The hash goes in the filename so the file can be cached forever.
  - A manifest:
    ```json
    {
      "mindFile": "/assets/targets.a1b2c3.mind",
      "targets": [
        { "index": 0, "id": "business-card", "source": "business-card.png", "width": 1200, "height": 800, "hash": "..." },
        { "index": 1, "id": "spring-poster", "source": "spring-poster.jpg", "width": 1600, "height": 2200, "hash": "..." }
      ]
    }
    ```
- **Critical:** MindAR anchors are addressed by **index in the compiled file**, and indexes shift when images are added or renamed. App code must **never hard-code an index**. Always resolve `id -> index` through the manifest.

### Validation (print clear, actionable messages)

- Image with no entry in `experiences.json`: **warn** (it builds, but shows nothing in production).
- Entry in `experiences.json` with no matching image: **error**.
- Image shorter than about 500px on its short side, or unsupported format: **warn**.
- Warn if the number of targets is large (report the resulting `.mind` size, because it affects mobile load time).
- Print a short tip on what makes a good tracking image: high detail and contrast, non-repeating features, no large flat or glossy areas, not mostly text on a plain background.

### Compiler implementation notes (verify against the installed package)

- MindAR ships an offline compiler in its source (look for `OfflineCompiler` under `src/image-target/`), typically used with the `canvas` package in Node. It may have native-dependency problems on some Node versions or OSes.
- **Fallback plan** if the Node compiler is unreliable: run MindAR's browser `Compiler` (`compileImageTargets` then `exportData`) inside headless Chromium via Playwright, and save the resulting buffer.
- Pick whichever is reliable on macOS, Windows, and Linux. Document the choice and why.

---

## 5. Content system (configurable mix per target)

`content/experiences.json` maps a target ID to what appears on it. A target can have any mix of items.

```json
{
  "spring-poster": {
    "title": "Spring Collection",
    "items": [
      { "type": "model", "src": "assets/vase.glb", "position": [0, 0, 0], "rotation": [90, 0, 0], "scale": 0.4, "animation": "auto" },
      { "type": "video", "src": "assets/teaser.mp4", "poster": "assets/teaser-poster.webp", "width": 1, "position": [0, -0.7, 0.01], "loop": true },
      { "type": "text",  "text": "Tap to see the collection", "position": [0, 0.75, 0.02], "width": 0.8 }
    ],
    "infoCard": {
      "heading": "Spring Collection",
      "body": "Hand-thrown ceramics, available now.",
      "cta": { "label": "View collection", "url": "https://example.com" }
    }
  }
}
```

### Item types

| Type | Behavior |
|---|---|
| `model` | GLB/GLTF. Auto-fit to the target width. Optional `animation` (`"auto"` plays the first clip, a clip name plays that clip, or omit). Support Draco and meshopt compressed files. |
| `video` | MP4 (H.264) on a plane using `VideoTexture`. `playsinline`, `muted` by default, optional `poster`. Play on target found, pause on target lost. Correct aspect ratio from the video's metadata. |
| `image` | WebP/PNG/JPG on a plane. Correct aspect ratio. |
| `text` | Rendered to a canvas texture on a plane, so no extra font or 3D-text dependency. Support size, color, and alignment. |

Also support `infoCard`. It is a **DOM overlay**, not a 3D object, so text stays crisp and accessible. It slides in when the target is found and includes an optional link button.

### Units and transforms

MindAR normalizes the target so its **width = 1 unit** and its height = the image's aspect ratio (verify in the docs and package). `position`, `scale`, and `rotation` (in degrees) are relative to the target's center. Validate the config with a schema (Zod or a hand-rolled check) and give readable error messages that name the target ID and item.

### Loading and lifecycle rules

- **Strictly per-target loading.** Assets for a target are requested only when that target is first detected. Scanning target A must never download target B's models, videos, or images. The only thing loaded up front for all targets is the single `.mind` file.
- **No prefetch of other targets by default.** Provide a single config flag (`prefetchOtherTargets`, default `false`). If enabled, it may quietly prefetch the remaining targets' assets after the first detection, and only when `navigator.connection?.saveData` is not set and the connection is not `2g`/`slow-2g`.
- **Progressive reveal, never a blank wait.** The moment a target is found, show whatever needs no download immediately, then layer in heavier items as they arrive:
  1. `infoCard` and `text` items appear instantly (they need no network).
  2. `image` items and video `poster` frames appear next (small files).
  3. `video` starts streaming right away. Require `+faststart` MP4s so playback begins after the first bytes, without waiting for the full file. Use `preload="auto"` only for the video of the detected target.
  4. `model` items fade in when ready, with a small on-anchor loading indicator until then.
  Load items for a target in parallel, ordered smallest-first.
- **Instant on re-detection.** Once a target's content has loaded, keep it in memory for the session so finding it again is instant, and rely on the HTTP cache across sessions. Cap memory with a small LRU (for example, keep the last 3 targets fully loaded; release older ones).
- On target found: fade the content in (about 250 ms), play video and animations, show the info card.
- On target lost: pause video and animations, hide the card after a short grace period, and avoid flicker (tune MindAR's tolerance and filter options; verify the option names in the package).
- Dispose geometries, textures, and video elements when a target is evicted from the LRU. There must be no memory growth from repeatedly finding and losing targets.
- Default `maxTrack` is 1. Make it configurable in one place.

---

## 6. Runtime flow

1. **Landing screen** loads instantly with minimal JS and CSS. It shows a short explanation and a **Start** button.
2. On tap (this also satisfies the user-gesture requirement for camera and video), **dynamically `import()`** the AR chunk (MindAR + Three.js) and fetch the `.mind` file. Show real progress.
3. Request camera permission with a friendly pre-prompt explanation.
4. **Scanning state**: a custom scanning UI. Disable MindAR's built-in loading, scanning, and error UIs (see the `uiLoading`, `uiScanning`, `uiError` options) and use our own.
5. **Found state**: content and info card appear.
6. **Lost state**: content pauses and hides, and the scanning hint returns.

### Error and edge states (each needs designed UI and helpful copy)

- Camera permission denied. Explain how to re-enable it.
- No camera, or an unsupported browser.
- Insecure context (not HTTPS).
- **In-app browsers** (Instagram, Facebook, TikTok, LinkedIn webviews often block camera access). Detect them where feasible and show "Open in Safari/Chrome" instructions.
- Failed `.mind` or asset download, with a retry button.
- Stop the camera and the render loop when the tab is hidden. Resume on return.
- Handle orientation changes and resize.

### Rendering defaults

- Cap device pixel ratio at 2. No shadows by default. Simple lighting (hemisphere or ambient plus one directional) so GLB models look good without an HDRI download.
- Make sure video and image planes are **color-correct** (sRGB handling changes between Three.js versions; verify visually against the source).

---

## 7. Performance requirements (mobile data is the priority)

### Budgets (report actuals versus these in the final summary)

| Item | Budget |
|---|---|
| Landing screen (HTML + CSS + JS, gzip/brotli) | **≤ 60 KB** transferred, excluding fonts |
| Fonts | ≤ 40 KB total, self-hosted, subsetted WOFF2, `font-display: swap`. A system font stack is acceptable |
| AR chunk (MindAR + Three.js) | Lazy-loaded. **Measure and report it.** MindAR bundles TensorFlow.js, so it will be the largest chunk. Don't hack the library, but tell me what could reduce it |
| `.mind` file | Report the size. Keep it lean (see the image guidance in section 4) |
| Each GLB | Target ≤ 1.5 MB |
| Each video | Target ≤ 3 MB (720p max, H.264, no audio unless needed) |
| Lighthouse mobile (landing) | Performance ≥ 90 |

### Required techniques

- Code-split so the landing page never loads the AR engine until needed. Optionally warm-load the AR chunk and `.mind` file on idle after first paint, **only** if `saveData` is off and the connection isn't slow. Otherwise load on Start tap.
- Long-lived caching: content-hashed filenames, `Cache-Control: immutable` guidance in the README, brotli or gzip on the host.
- Use `rollup-plugin-visualizer` (or similar) to produce a bundle report as a dev tool only.
- Import only what's needed from Three.js (named imports). Load Draco or meshopt decoders lazily, and only if a model needs them.
- Provide an **asset optimization guide** in the README and an optional `npm run optimize` script. GLB: `gltf-transform` with meshopt plus WebP or KTX2 textures. Video: an `ffmpeg` command for 720p H.264 with `+faststart`. Images: WebP. These may be documented commands rather than dependencies.
- **Stretch goal, only after all phases pass:** a small service worker for repeat-visit caching of the `.mind` file and used assets.

---

## 8. UI/UX direction

**The camera feed is the hero.** Interface chrome should be minimal, quiet, and get out of the way.

### Process

Before writing UI code, produce a short **design plan** and get my approval. It should contain:

- **Color:** 4 to 6 named hex values, with light/dark handled sensibly (the UI floats over a camera feed, so consider translucent surfaces and contrast).
- **Type:** the typeface(s) and their roles. One family is fine.
- **Layout:** a one-sentence concept plus ASCII wireframes for landing, scanning, found, and error screens. State alignment (left or center) for each.
- **Principles:** what makes this feel deliberate rather than templated.

Review your own plan against these guardrails, and say what you changed:

- Avoid the generic "neon sci-fi AR" look and default AI-design tells: cream and terracotta, near-black with an acid accent, identical rounded cards with the same soft shadow, gradient washes as decoration, ALL-CAPS eyebrow labels, "→" on every button.
- One accent color. One memorable element (for example a well-crafted scanning frame animation). Everything else stays quiet.
- Motion only where it answers an action or signals state (scanning pulse, found confirmation, card slide-in). Respect `prefers-reduced-motion`.
- All colors, radii, spacing, and type sizes live as **CSS custom properties in one tokens file**, so the owner can re-brand in minutes. The app name and copy also live in one config file.

### Quality floor

- Mobile-first, works down to 360px wide, and handles landscape.
- Safe-area insets (`env(safe-area-inset-*)`) for notches and home indicators.
- Touch targets ≥ 44px. Visible keyboard focus. Text contrast ≥ 4.5:1 over any camera background (use scrims where needed). Screen-reader-friendly labels and live-region announcements for found and lost states.
- No layout shift during load.

### Copy

Plain, specific, sentence case, active voice. Buttons say exactly what they do. Errors say what happened and how to fix it, and never apologize or stay vague. Example: "Camera access is blocked. Enable it in your browser's site settings, then reload."

---

## 9. Dev and test workflow

- **HTTPS on a real phone:** support `vite --host` with `@vitejs/plugin-basic-ssl`, and document a tunnel option (Cloudflare Tunnel or ngrok) as an alternative. Document both.
- **Preview mode (`?preview=<targetId>`):** renders that target's content on a fixed plane in a plain Three.js scene with no camera and no MindAR. Use it to verify models, video, text, transforms, and the info card in your own browser. Gate it so it's stripped or disabled in production builds.
- **Debug mode (`?debug=1`):** a small HUD with FPS, the currently tracked target ID, and load timings. Also gated for dev only.
- **Unit tests (Vitest):** manifest generation (ordering, hashing, `id -> index` mapping, validation errors) and config schema validation.
- **Manual phone checklist:** put it in the README (iOS Safari, Android Chrome, target found and lost, video plays, model animates, permission denied flow, in-app browser).
- **Print sheet:** a page or script that outputs the target images at a sensible size for print testing.

---

## 10. Suggested project structure

```
/
├─ targets/                    # drop tracking images here
├─ content/
│  ├─ experiences.json
│  └─ assets/
├─ src/
│  ├─ main.ts                  # landing + bootstrap, tiny
│  ├─ ar/                      # lazy chunk: MindAR session, anchors, lifecycle
│  ├─ content/                 # loaders/builders: model, video, image, text, infoCard
│  ├─ ui/                      # screens, scanning frame, error states
│  ├─ styles/                  # tokens.css + components
│  └─ config/                  # app name, copy, tuning constants
├─ tools/
│  ├─ compile-targets/         # compiler + manifest logic (unit-tested)
│  └─ vite-plugin-mind-targets.ts
├─ tests/
├─ vite.config.ts
└─ README.md
```

Adapt as needed, and explain deviations in the plan.

---

## 11. Phases and acceptance criteria

**Phase 0: Spike and plan**
- MindAR + Three.js runs under Vite with one hard-coded target (verified via preview mode, plus my phone test).
- A `.mind` file compiled from the command line with no manual step. Compiler approach chosen and justified.
- Compatible `three` and `mind-ar` versions identified and pinned.
- Written implementation plan and design plan delivered. **Stop for approval.**

**Phase 1: Drop-and-compile pipeline**
- Drop an image into `targets/` while dev is running: recompile plus reload with no manual steps.
- Manifest, hashed `.mind` file, caching, and validation messages all work.
- Unit tests pass. No hard-coded indexes anywhere.

**Phase 2: Content system**
- All four item types plus `infoCard` work from `experiences.json`.
- Lazy per-target loading, found and lost lifecycle, and disposal work.
- **Verified in the browser Network panel:** before any target is detected, only the landing assets, AR chunk, and `.mind` file have been requested. Detecting target A requests only A's assets. Nothing for other targets appears.
- **Time-to-first-content** (target found to first visible content) is logged in debug mode. Text and info card appear immediately, and video playback starts before the file finishes downloading. Report the numbers on a throttled "Fast 4G" profile.
- Preview mode shows every item type correctly.

**Phase 3: UI and states**
- Approved design implemented. All screens and error states built.
- Accessibility and quality floor met. Copy reviewed.

**Phase 4: Performance pass**
- Bundle report, Lighthouse mobile run, and actual-versus-budget table delivered.
- Anything over budget has a written explanation and a proposed fix.

**Phase 5: Ship-ready**
- README covers setup, adding targets, adding content, asset optimization, deploy (one host walked through end to end), and the phone test checklist.
- Production build verified: dev-only modes stripped, hashed assets, no console errors.

---

## 12. Ask me these before starting

1. Brand name, and any colors, logo, or fonts I want used.
2. Roughly how many tracking images will there be at launch and later? (This affects `.mind` size and `maxTrack`.)
3. Do I have real sample content (target images, GLB, video), or should you generate clearly labeled placeholders? Never ship copyrighted material.
4. Where will this be hosted?
5. Any languages other than English?

---

## 13. Non-goals

No backend, accounts, CMS, or analytics. No face tracking or world/SLAM tracking. No in-browser "upload an image and compile it" feature (dev-time pipeline only). No native app or wrapper.

## 14. Definition of done

- All phase acceptance criteria met, with a final summary that includes the budget table and a list of what was verified only in preview mode versus on a real device.
- A developer can add a new AR experience by (1) dropping an image in `targets/`, (2) adding an entry to `experiences.json`, and (3) dropping asset files in `content/assets/`. No code changes.
