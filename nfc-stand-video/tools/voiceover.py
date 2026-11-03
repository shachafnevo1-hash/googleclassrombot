#!/usr/bin/env python3
"""Generate the Hebrew narration with Microsoft's neural voice (he-IL-HilaNeural).

    pip install edge-tts
    python tools/voiceover.py          # writes voiceover/01.mp3 ... 05.mp3
    node tools/render.js mux           # remixes audio into the existing MP4 (no re-render)

Needs internet access to speech.platform.bing.com. Any other recording works too:
just save line N as voiceover/NN.mp3 or NN.wav.
"""
import asyncio, json, os, pathlib, ssl
import edge_tts
import edge_tts.communicate as _c

# Behind an HTTPS proxy: route through it and trust its CA bundle if one is provided.
PROXY = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
CA = os.environ.get("SSL_CERT_FILE") or ("/root/.ccr/ca-bundle.crt" if os.path.exists("/root/.ccr/ca-bundle.crt") else None)
if CA:
    _c._SSL_CTX = ssl.create_default_context(cafile=CA)

ROOT = pathlib.Path(__file__).resolve().parent.parent
cfg = json.loads((ROOT / "voiceover" / "script.json").read_text(encoding="utf-8"))

async def main():
    for i, line in enumerate(cfg["lines"], 1):
        out = ROOT / "voiceover" / f"{i:02d}.mp3"
        await edge_tts.Communicate(line["text"], cfg["voice"], rate=cfg.get("rate", "+0%"), proxy=PROXY).save(str(out))
        print("wrote", out)

asyncio.run(main())
