# Guide images

Builds the images in `docs/guides/images/`: phone and browser mockups with zoom callouts, from screenshots of the live demo.

| Step | Script | Output |
|---|---|---|
| 1. Capture | `capture.mjs` | Read-only screenshots of the live site at 2x, in `.out/captures/` |
| 2. Frame | `mockups.mjs` | SVG phone and browser frames with zoom callouts, rendered to transparent PNGs in `.out/mockups/<set>/` |
| 3. Publish | `to_webp.py` | Trimmed and resized WebP files in `docs/guides/images/` |

`.out/` is git-ignored.

## Run the pipeline

Prerequisites: Node 22 or later, the frontend dependencies (`cd frontend && npm install`), Google Chrome, and Python 3 with Pillow.

```bash
# 1. capture. Dashboard views need the evaluator demo password. Never commit it.
TERRA_DEMO_PASSWORD=… node scripts/guide-images/capture.mjs all   # or: time | priority | phone | flow

# 2. frame (set: guides | pitch)
node scripts/guide-images/mockups.mjs guides

# 3. publish
python scripts/guide-images/to_webp.py guides
```

## Read-only by design

`capture.mjs` does not write to the live site. It signs in with the evaluator demo account and only reads.

To frame the map on Antakya, it filters the `/reports` responses to a bounding box **inside its own browser**. This filter also hides stray test reports in other places. Nothing on the server changes.

## Source screenshots

`capture.mjs flow` captures the map screens of the reporter. The capture point is on Yavuz Sultan Selim Caddesi, Antakya. The capture run examined 62 points. This point leaves the least OSM building area uncovered by the footprints.

The photo, damage, survey and confirmation screens, and the admin screens, come from the earlier visual-guide capture run. A real upload is necessary to get past the photo step, and an upload writes to the live photo bucket.

`GUIDE_SOURCE_DIR` sets the directory of those screenshots. The default is `submission/visual-guide-assets`, which is kept locally. `GUIDE_CAPTURE_DIR` sets the directory from which `mockups.mjs` reads the output of `capture.mjs`.

## Edit a callout

`mockups.mjs` holds the callout of each image:

```js
callout: { x, y, w, h, side, scale }
```

- `x`, `y`, `w`, `h`: the source rectangle, in the CSS pixels of the screenshot (390 × 844 for phones).
- `side`: `left` or `right`.
- `scale`: the magnification.
