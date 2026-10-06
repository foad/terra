# Guide images

Builds the images in `docs/guides/images/`: phone and browser mockups with zoom callouts, from screenshots of the live demo.

The pipeline has three steps.

| Step | Script | Output |
|---|---|---|
| 1. Capture | `capture.mjs` | Read-only screenshots of the live site at 2x, in `.out/captures/` |
| 2. Frame | `mockups.mjs` | SVG phone/browser frames and zoom callouts rendered to transparent PNGs, in `.out/mockups/<set>/` |
| 3. Publish | `to_webp.py` | Trimmed, resized WebP files in `docs/guides/images/` |

`.out/` is git-ignored.

## Running it

Requires Node 22+, the frontend dependencies (`cd frontend && npm install`), Google Chrome, and Python 3 with Pillow.

```bash
# 1. capture (dashboard views need the evaluator demo password; never commit it)
TERRA_DEMO_PASSWORD=… node scripts/guide-images/capture.mjs all   # or: time | priority | phone

# 2. frame (set: guides | pitch)
node scripts/guide-images/mockups.mjs guides

# 3. publish
python scripts/guide-images/to_webp.py guides
```

## Read-only by design

`capture.mjs` never writes to the live site. It signs in with the evaluator demo account, and only reads.

To frame the map on Antakya, it filters `/reports` responses **inside its own browser** to a bounding box. This also hides stray test reports elsewhere. Nothing on the server changes.

## Source screenshots

Some community-flow and admin screenshots come from the earlier visual-guide capture run, not `capture.mjs`. The phone flow needs a building tap and a photo upload, and an upload would write to the live photo bucket.

Point `GUIDE_SOURCE_DIR` at those screenshots (default `submission/visual-guide-assets`, kept locally). `GUIDE_CAPTURE_DIR` overrides where `mockups.mjs` reads `capture.mjs` output from.

## Editing a callout

Callouts are set per image in `mockups.mjs`:

```js
callout: { x, y, w, h, side, scale }
```

- `x`, `y`, `w`, `h`: the source rectangle, in the screenshot's CSS pixels (390 × 844 for phones).
- `side`: `left` or `right`.
- `scale`: magnification.
