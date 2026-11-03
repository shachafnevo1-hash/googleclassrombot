#!/usr/bin/env python3
"""Generate the Hebrew narration with Microsoft's neural voice (he-IL-HilaNeural).

    pip install edge-tts
    python tools/voiceover.py          # writes voiceover/01.mp3 ... 05.mp3
    node tools/render.js mux           # remixes audio into the existing MP4 (no re-render)

Needs internet access to speech.platform.bing.com. Any other recording works too:
just save line N as voiceover/NN.mp3 or NN.wav.
"""
import asyncio, json, pathlib
import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
cfg = json.loads((ROOT / "voiceover" / "script.json").read_text(encoding="utf-8"))

async def main():
    for i, line in enumerate(cfg["lines"], 1):
        out = ROOT / "voiceover" / f"{i:02d}.mp3"
        await edge_tts.Communicate(line["text"], cfg["voice"], rate=cfg.get("rate", "+0%")).save(str(out))
        print("wrote", out)

asyncio.run(main())
