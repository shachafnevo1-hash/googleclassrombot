# NFC Google Review Stand — product film

An 18-second, 1920×1080, 60 fps product film for the NFC Google Review stand.
Everything is drawn in code: the 3D acrylic stand and phone (WebGL2), the Hebrew UI (Canvas 2D),
and the music and sound effects (Web Audio). The only external media is optional voice-over audio.

## Run

```bash
npm install                                   # fonts are vendored in fonts/; Playwright must be available
node tools/render.js video                    # → out/nfc-review-stand.mp4 (~20 min on 4 cores)
node tools/render.js stills 4.9,6.5,10.6,17.5 # → out/stills/*.png for inspection
```

## Adding the Hebrew narrator

The script and its timing are in `voiceover/script.json` (5 short lines, calm female voice).
Any recording works: save line N as `voiceover/NN.mp3` or `voiceover/NN.wav` (`01` … `05`). Then run:

```bash
node tools/render.js mux     # re-mixes the audio into the existing MP4; the picture is not re-rendered
```

The voice is placed at each line's time, and the music automatically ducks underneath it.
To generate the voice with Microsoft's free neural Hebrew voice (he-IL-HilaNeural, needs internet):

```bash
pip install edge-tts && python tools/voiceover.py && node tools/render.js mux
```

## How it works

| File | What it does |
|---|---|
| `src/timeline.js` | **The film.** `TL.frame(t)` is a pure function of `t`. Scene timing, poses, Hebrew headlines and cue times are all here. |
| `src/art.js` | The stand's printed face (matched to the real product photos, rendered at 2×), the phone screen, and the Hebrew RTL search, review dialog and review cards. |
| `src/gl3d.js` | WebGL2 renderer. The stand is one sheet of 3 mm white acrylic bent into an L, with the foot running backward. The phone is at real scale (about 2 cm smaller than the stand). Both are rendered at 2× and downsampled. |
| `src/audio.js` | A calm 120 BPM music bed plus minimal SFX: NFC chime with a short vibration, and soft clicks for the notification, the stars and Post. |
| `src/util.js` | Easing, keyframes, drawing helpers, and the official Google "G" vector paths. |
| `tools/render.js` | Parallel headless render, x264 encode, voice-over mix with ducking, and AAC mux. |

Business names, people and reviews in the film are fictional. Fonts: Rubik, Open Sans and Inter (SIL OFL, see `fonts/`).
