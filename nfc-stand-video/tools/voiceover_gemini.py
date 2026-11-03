#!/usr/bin/env python3
"""Generate the Hebrew narration with Google's Gemini TTS (natural Hebrew voices).

Uses a free Google AI Studio API key (https://aistudio.google.com/apikey) read from
the GEMINI_API_KEY environment variable. No extra packages needed.

    python tools/voiceover_gemini.py            # writes voiceover/01.wav ... 05.wav
    node tools/render.js mux                    # mixes them into the existing MP4

Optional: GEMINI_TTS_VOICE (default "Achernar" - soft female; also try Sulafat,
Vindemiatrix, Aoede, Callirrhoe) and GEMINI_TTS_MODEL.
"""
import base64, json, os, pathlib, ssl, sys, time, urllib.request, wave

ROOT = pathlib.Path(__file__).resolve().parent.parent
KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if not KEY:
    sys.exit("Set GEMINI_API_KEY (free key from https://aistudio.google.com/apikey).")
MODEL = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")
VOICE = os.environ.get("GEMINI_TTS_VOICE", "Achernar")
STYLE = ("Read the following Hebrew sentence aloud in natural, native Israeli Hebrew, "
         "with a calm, soft, warm female voice, unhurried, like a premium product ad. "
         "Say only the sentence:\n")

ca = os.environ.get("SSL_CERT_FILE") or ("/root/.ccr/ca-bundle.crt" if os.path.exists("/root/.ccr/ca-bundle.crt") else None)
CTX = ssl.create_default_context(cafile=ca) if ca else ssl.create_default_context()
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

cfg = json.loads((ROOT / "voiceover" / "script.json").read_text(encoding="utf-8"))
for i, line in enumerate(cfg["lines"], 1):
    body = {
        "contents": [{"parts": [{"text": STYLE + line["text"]}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}},
        },
    }
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "x-goog-api-key": KEY})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, context=CTX, timeout=120) as r:
                data = json.load(r)
            break
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 3:
                time.sleep(20 * (attempt + 1)); continue
            sys.exit(f"Gemini TTS error {e.code}: {e.read().decode()[:400]}")
    pcm = base64.b64decode(data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
    # remove any other format of this line so the mixer picks the new one
    for ext in ("mp3", "m4a"):
        (ROOT / "voiceover" / f"{i:02d}.{ext}").unlink(missing_ok=True)
    out = ROOT / "voiceover" / f"{i:02d}.wav"
    with wave.open(str(out), "wb") as w:  # Gemini returns 24 kHz, 16-bit mono PCM
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
    print("wrote", out)
