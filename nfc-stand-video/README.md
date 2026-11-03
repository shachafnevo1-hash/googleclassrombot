# NFC Google Review Stand — product film

An 18-second, 1920×1080, 60 fps motion-graphics product film for the NFC Google Review stand.
Everything is drawn in code: the 3D acrylic stand and phone (WebGL2), the UI cards (Canvas 2D),
and the music and sound effects (Web Audio `OfflineAudioContext`). No image or audio files are used.

## Run

```bash
npm install            # fonts are already vendored in fonts/; Playwright must be available
node tools/render.js video                  # → out/nfc-review-stand.mp4 (≈25 min on 4 cores)
node tools/render.js stills 5.0,5.9,8.5,16.5  # → out/stills/*.png for inspection
node tools/render.js audio                  # → out/soundtrack.wav
```

To preview interactively with a scrubber and audio, serve the folder (e.g. `npx serve .`) and open `index.html`.

Render options: `--workers 3`, `--samples 4` (temporal sub-frames per output frame), `--from/--to` (frame range).

## How it works

| File | What it does |
|---|---|
| `src/timeline.js` | **The film.** `TL.frame(t)` draws a full frame as a pure function of `t`. Scene timing, poses (keyframes), headlines and cues are all here. |
| `src/art.js` | Procedural artwork: the stand's printed face (Hebrew is set with `direction: 'rtl'`), the G badge, the phone screen, the search UI, review cards and the status bar. |
| `src/gl3d.js` | Small WebGL2 renderer: the L-shaped acrylic stand with its thickness and raised G badge, the phone, the floor reflection and the gloss sweep. |
| `src/audio.js` | Synthesized 120 BPM track (kick, hats, sub-bass, marimba plucks, pads) and SFX, timed from `TL.CUES`. |
| `src/util.js` | Easing (cubic-bezier, critically damped springs), keyframes, and drawing helpers. |
| `src/main.js` | Loads the fonts and exposes `window.seek(t)` and `window.renderFrame(i)`. `renderFrame` averages 4 sub-frames across a 180° shutter to create motion blur. |
| `tools/render.js` | Headless Chromium renders disjoint frame ranges in parallel, pipes them to x264, concatenates the parts and muxes the AAC audio. |

Common edits:
- **Text:** `HEADLINES` in `timeline.js`, and `Art.standFace()` for the Hebrew on the stand.
- **Timing:** the `tin`/`tout` values and the `U.KF([...])` pose keyframes.
- **Colours:** `U.C` in `util.js`.

Fonts are Rubik (Hebrew and Latin) and Inter, under the SIL Open Font License (see `fonts/`).
Business names, people and reviews shown in the film are fictional.
