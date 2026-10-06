"""Cut the product out of its pure-black studio background.

Produces assets/product-cutout.png (RGBA, tightly cropped) without the
floor reflection, with a soft anti-aliased alpha edge.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
src = Image.open(ROOT / "assets/product-original.png").convert("RGB")
rgb = np.asarray(src).astype(np.float32)
lum = rgb.mean(axis=2)
maxch = rgb.max(axis=2)
h, w = maxch.shape

# 1. Background = dark pixels connected to the image border.
dark = maxch <= 16
labels, _ = ndimage.label(dark)
border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
bg = np.isin(labels, border[border > 0])
fg = ~bg

# 2. Drop the mirror reflection on the floor: per column, keep only rows down
#    to the last bright pixel of the acrylic base (reflection peaks at ~125).
y0 = 860
for x in range(w):
    col = lum[y0:, x]
    bright = np.where(col > 150)[0]
    cut = y0 + (bright.max() + 2 if bright.size else 0)
    fg[cut:, x] = False

# Keep only the largest connected component (the product itself).
lab, n = ndimage.label(fg)
sizes = ndimage.sum(fg, lab, range(1, n + 1))
fg = lab == (np.argmax(sizes) + 1)
fg = ndimage.binary_fill_holes(fg)

# 3. Alpha matte: interior is opaque; a thin band at the silhouette gets a
#    fractional alpha estimated against the local interior brightness
#    (the background is pure black, so observed = alpha * colour).
interior = ndimage.binary_erosion(fg, iterations=2)
band = ndimage.binary_dilation(fg, iterations=1) & ~interior
ref = ndimage.maximum_filter(np.where(interior, maxch, 0), size=9)
ref = np.maximum(ref, 60)
alpha = np.where(interior, 1.0, 0.0)
est = np.clip((maxch - 6) / (ref - 6), 0, 1)
alpha = np.where(band, est, alpha)
alpha = np.where(fg | band, alpha, 0.0)

# Un-premultiply edge colours so they don't carry a black fringe.
safe = np.maximum(alpha, 1e-3)[..., None]
colour = np.where((alpha > 0.04)[..., None] & ~interior[..., None], np.clip(rgb / safe, 0, 255), rgb)

out = np.dstack([colour, alpha * 255]).astype(np.uint8)
ys, xs = np.where(alpha > 0.02)
box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
img = Image.fromarray(out, "RGBA").crop(box)
img.save(ROOT / "assets/product-cutout.png")
print("cutout", img.size, "bbox in source", box)
