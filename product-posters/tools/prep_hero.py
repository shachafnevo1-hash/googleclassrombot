"""Prepare the product texture for the 3D hero render.

- 2x Lanczos upscale + gentle unsharp mask (the stand covers ~1000px tall in
  the final 2160x2700 render, so we sample a slightly oversized texture).
- Colour bleeding: transparent pixels take the colour of the nearest opaque
  pixel, so bilinear/mipmapped sampling never drags in a dark fringe.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
img = Image.open(ROOT / "assets/product-cutout.png").convert("RGBA")
w, h = img.size
big = img.resize((w * 2, h * 2), Image.LANCZOS)

rgb = big.convert("RGB").filter(ImageFilter.UnsharpMask(radius=2.2, percent=55, threshold=2))
a = np.asarray(big)[..., 3]
rgb = np.asarray(rgb).copy()

solid = a > 200
_, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
bled = rgb[iy, ix]
rgb = np.where((a > 200)[..., None], rgb, bled)

out = np.dstack([rgb, a]).astype(np.uint8)
Image.fromarray(out, "RGBA").save(ROOT / "assets/product-hero.png")
print("product-hero.png", out.shape[1], "x", out.shape[0])
