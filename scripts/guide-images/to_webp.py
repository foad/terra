"""Trim, resize and convert rendered mockups to WebP for docs/guides/images.

Usage: python scripts/guide-images/to_webp.py [set]   (default set: guides)
Phones are capped at 900 px tall; browser windows at 1400 px wide (about 2x their on-page size).
"""
import glob
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SET = sys.argv[1] if len(sys.argv) > 1 else "guides"
SRC = os.path.join(HERE, ".out", "mockups", SET)
DST = os.path.join(HERE, "..", "..", "docs", "guides", "images")
os.makedirs(DST, exist_ok=True)

total = 0
for f in sorted(glob.glob(os.path.join(SRC, "*.png"))):
    im = Image.open(f)
    l, t, r, b = im.split()[3].getbbox()
    m = 6
    im = im.crop((max(0, l - m), max(0, t - m), min(im.width, r + m), min(im.height, b + m)))
    tall = im.height > im.width
    scale = min(1, (900 / im.height) if tall else (1400 / im.width))
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    out = os.path.join(DST, os.path.splitext(os.path.basename(f))[0] + ".webp")
    im.save(out, "WEBP", quality=82, method=6)
    size = os.path.getsize(out)
    total += size
    print(f"{os.path.basename(out):24} {im.width}x{im.height}  {size // 1024} KB")
print(f"total {total // 1024} KB")
