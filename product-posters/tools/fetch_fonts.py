"""Download the Google Fonts used by the posters into assets/fonts and write
assets/fonts/fonts.css with local @font-face rules (full TTFs, so Hebrew is
always included)."""
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "assets/fonts"
FAMILIES = [
    "Rubik+Pixels", "Press+Start+2P", "Silkscreen:wght@400;700", "VT323",
    "Heebo:wght@100;200;300;400;500;700;800;900",
    "Rubik:wght@300;400;500;600;700;800;900",
    "Anton", "Bebas+Neue", "Archivo+Black",
    "Jost:wght@300;400;500;600;700;800;900",
    "Bangers", "Secular+One", "Suez+One",
    "Karantina:wght@300;400;700",
    "Frank+Ruhl+Libre:wght@300;400;500;700;900", "Bellefair",
    "Rubik+Bubbles", "Rubik+Gemstones", "Rubik+80s+Fade", "Rubik+Glitch", "Rubik+Mono+One",
    "Fredoka:wght@400;500;600;700", "Varela+Round",
    "Audiowide", "Orbitron:wght@400;700;900", "Michroma", "Unbounded:wght@400;700;900",
    "Space+Mono:wght@400;700", "Space+Grotesk:wght@300;400;500;700",
]


def curl(url, out=None):
    cmd = ["curl", "-sSfL", url] + (["-o", str(out)] if out else [])
    return subprocess.run(cmd, check=True, capture_output=True, text=out is None).stdout


css_out = []
for fam in FAMILIES:
    css = curl(f"https://fonts.googleapis.com/css2?family={fam}&display=block")
    for block in re.findall(r"@font-face\s*{[^}]*}", css):
        name = re.search(r"font-family:\s*'([^']+)'", block).group(1)
        weight = re.search(r"font-weight:\s*(\d+)", block).group(1)
        style = re.search(r"font-style:\s*(\w+)", block).group(1)
        url = re.search(r"url\((https://[^)]+)\)", block).group(1)
        fname = f"{name.replace(' ', '')}-{weight}{'i' if style == 'italic' else ''}.ttf"
        if not (FONT_DIR / fname).exists():
            curl(url, FONT_DIR / fname)
        css_out.append(
            f"@font-face{{font-family:'{name}';font-style:{style};font-weight:{weight};"
            f"font-display:block;src:url('{fname}') format('truetype');}}"
        )
        print(fname)

# GNU Unifont: a true 16px bitmap font with full Hebrew coverage (8-bit poster).
unifont = Path("/usr/share/fonts/opentype/unifont/unifont.otf")
if unifont.exists():
    (FONT_DIR / "Unifont.otf").write_bytes(unifont.read_bytes())
    css_out.append(
        "@font-face{font-family:'Unifont';font-style:normal;font-weight:400;"
        "font-display:block;src:url('Unifont.otf') format('opentype');}"
    )

(FONT_DIR / "fonts.css").write_text("\n".join(css_out) + "\n")
