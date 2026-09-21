# Ever WebAR — Mobile-First WebAR Image-Tracking Application

> High-performance WebAR application built with **MindAR-JS**, **Three.js**, and **Vite**. Features an automatic drag-and-drop target compilation pipeline, progressive content reveal, strict per-target asset loading, and full-bleed camera immersion.

---

## 1. Quick Start

### Prerequisites
- **Node.js**: v18+ or v20+ LTS
- **npm**: v9+

### Setup
```bash
# Clone and install dependencies
git clone <repo-url>
cd AR-web-app
npm install

# Start local development server with HTTPS (required for camera access)
npm run dev
```

The Vite dev server will start on:
- **Local:** `https://localhost:5173/`
- **Network (Mobile Testing):** `https://<your-local-ip>:5173/` (e.g. `https://192.168.0.105:5173/`)

---

## 2. Developer Workflow

### Adding a New Tracking Image
1. Drop your tracking image (`.jpg`, `.jpeg`, or `.png`) into the `targets/` folder:
   ```
   targets/
     summer-poster.jpg
     business-card.png
   ```
2. The filename stem becomes the unique, slug-safe target ID (`summer-poster`).
3. While `npm run dev` is running, the local watcher detects the change, automatically recompiles all targets into a single hashed `.mind` binary with SHA-256 caching, updates `public/targets-manifest.json`, and reloads the browser.
4. To compile manually at any time:
   ```bash
   npm run targets
   ```

### Target Image Quality Guidelines
For optimal tracking stability in real-world lighting:
- **High Contrast & Detail:** Rich geometric features, corners, and organic detail.
- **Non-Repeating Patterns:** Avoid identical repeating checkerboards or uniform stripes.
- **Minimum Dimensions:** Keep the short side at least **500px** (recommended 800px–1600px).
- **Avoid:** Large glossy/reflective surfaces, solid flat color fills, or plain text on a blank background.

### Print Sheet Testing
Open **`https://localhost:5173/print.html`** in your browser and click **Print Cards** to output standard physical test cards with dimensions, IDs, and alignment guides.

---

## 3. Content Configuration (`content/experiences.json`)

Map any mix of 3D models, video textures, images, and canvas text to any registered target ID:

```json
{
  "summer-poster": {
    "title": "Summer Exhibition",
    "items": [
      {
        "type": "text",
        "text": "SUMMER COLLECTION",
        "position": [0, 0.65, 0.02],
        "width": 0.85,
        "color": "#38bdf8"
      },
      {
        "type": "model",
        "src": "/content/assets/vase.glb",
        "position": [0, 0.05, 0.1],
        "scale": 0.55,
        "animation": "auto"
      },
      {
        "type": "video",
        "src": "/content/assets/teaser.mp4",
        "poster": "/content/assets/teaser-poster.webp",
        "width": 0.65,
        "position": [0, -0.42, 0.01],
        "loop": true
      },
      {
        "type": "image",
        "src": "/content/assets/badge.webp",
        "width": 0.28,
        "position": [0.36, 0.5, 0.03]
      }
    ],
    "infoCard": {
      "heading": "Summer Exhibition",
      "body": "Ceramics & digital sculpture tracked in real time."
    }
  }
}
```

### Supported Item Types
| Type | Description |
|---|---|
| `model` | GLTF/GLB binary format. Automatically fits to target width. Optional `animation` (`"auto"` plays first clip, or provide clip name). Supports Draco and meshopt. |
| `video` | MP4 (H.264) rendered on an augmented 3D plane using `VideoTexture`. `playsinline` and `muted`. Starts streaming immediately with `+faststart`. Optional `poster` image. |
| `image` | WebP/PNG/JPG plane overlay with automatic aspect-ratio preservation. |
| `text` | Rendered dynamically to a high-resolution 2D Canvas texture. No external fonts or heavy 3D text geometry. |
| `infoCard` | Sleek, non-intrusive bottom DOM overlay displaying contextual details without obscuring the camera. |

### Units & Coordinates
- Normalized target coordinate system: **Target Width = 1.0 unit**, Height = Image Aspect Ratio.
- `position`: `[x, y, z]` relative to target center (`z > 0` floats above the image).
- `rotation`: `[x, y, z]` in degrees.
- `scale`: number or `[x, y, z]`.

---

## 4. Performance & Lifecycle Architecture

1. **Strict Per-Target Lazy Loading:** Assets for target A are requested **only** when target A is first recognized. Scanning target A never downloads target B's assets.
2. **Progressive Reveal Hierarchy:**
   - **Stage 1 (0ms delay):** Info Card and Canvas Text mount instantly.
   - **Stage 2 (~60ms):** Images and video poster frames appear.
   - **Stage 3 (~150ms):** Video starts streaming playback immediately.
   - **Stage 4 (~350ms):** 3D GLB model fades in smoothly with a temporary anchor ring marker.
3. **LRU Memory Management (Cap: 3 Targets):**
   - Keeps the last 3 detected targets in memory for instantaneous re-detection.
   - Evicts older targets and calls `dispose()` on all geometries, textures, materials, and video elements to prevent memory leaks on mobile devices.
4. **Code-Split Landing Bundle:**
   - Landing page JS + CSS transfers in **< 10 KB gzip** (budget: ≤ 60 KB).
   - MindAR and Three.js engine chunks are lazy-loaded on user gesture or idle warm-loading.

---

## 5. Asset Optimization Recipes

Run the optimization script to automatically prepare videos and images:
```bash
npm run optimize
```

### Manual Command Recipes
- **Video (`+faststart` H.264 720p):**
  ```bash
  ffmpeg -y -i input.mp4 -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart -an output.mp4
  ```
- **Video Poster Extraction:**
  ```bash
  ffmpeg -y -ss 00:00:01 -i input.mp4 -vframes 1 poster.webp
  ```
- **3D GLB Optimization (Meshopt + Draco):**
  ```bash
  npx @gltf-transform/cli optimize input.glb output.glb --compress meshopt
  ```

---

## 6. Deployment (End-to-End Walkthrough)

Deployable to any static HTTPS CDN host (Cloudflare Pages, Vercel, Netlify, GitHub Pages).

### Cloudflare Pages / Vercel Setup
1. **Connect Repository:** Link your Git repository.
2. **Build Settings:**
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Node.js Version:** `20.x`
3. **Cache-Control Configuration (`_headers` file for Cloudflare Pages):**
   ```http
   /assets/*
     Cache-Control: public, max-age=31536000, immutable

   /*.mind
     Cache-Control: public, max-age=31536000, immutable
   ```

---

## 7. Phone Testing Checklist

| Test Item | iOS (Safari) | Android (Chrome) | Expected Behavior |
|---|---|---|---|
| **HTTPS SSL Acceptance** | [ ] | [ ] | Loads landing page without console errors; bypass self-signed warning on local dev. |
| **Landing Performance** | [ ] | [ ] | Instant first paint (< 300ms); zero layout shifts; touch target ≥ 48px. |
| **Permission Pre-Prompt** | [ ] | [ ] | Tap **Start AR Experience** prompts camera access cleanly. |
| **Permission Denied Recovery** | [ ] | [ ] | Deny camera permission: error card shows step-by-step unblock instructions with **Try Again** action. |
| **In-App WebView Detection** | [ ] | [ ] | Open link inside Instagram/TikTok/LinkedIn: card instructs user to open in Safari/Chrome with **Copy Page Link** button. |
| **Scanning Reticle** | [ ] | [ ] | Viewfinder reticle with laser sweep displays until card is in view. |
| **Target Lock Immersion** | [ ] | [ ] | Reticle disappears completely; camera feed fills 100% full screen edge-to-edge. |
| **Progressive Content** | [ ] | [ ] | Text & Info card appear immediately; video streams with `playsinline`; 3D model fades in. |
| **Target Lost Behavior** | [ ] | [ ] | Move card out of view: video pauses; card slides away; scanning reticle returns. |
| **Tab Backgrounding** | [ ] | [ ] | Switch to another tab or lock phone: render loop and video pause; resume smoothly on return. |
| **Orientation & Landscape** | [ ] | [ ] | Rotate device 90°: projection matrix and camera aspect ratio recalculate automatically. |
| **3D Preview Mode** | [ ] | [ ] | `?preview=sample-target`: renders full 3D experience with orbit touch controls and no camera required. |
| **Debug Telemetry** | [ ] | [ ] | `?debug=1`: displays active FPS, target ID, and Time-to-First-Content (TTFC). |

---

## 8. Test Suite

Run unit tests verifying manifest generation, deterministic sorting, slug validation, collision detection, and schema compliance:
```bash
npm test
```
All 12 unit tests execute in under 2 seconds.
