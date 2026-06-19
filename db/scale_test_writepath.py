"""Fire write-path tests against the deployed API for #200. Three modes:

    db-only      POST /reports with empty free-text, no photo_key.
                 Measures the pure DB write path (duplicate check at
                 500k existing rows, version chain, INSERT, trigger).
                 $0 Bedrock.

    with-text    POST /reports with realistic infrastructure_description
                 (and a contact email so PII redaction has work to do).
                 Adds redact_pii + translate_to_english to the DB path.
                 ~$0.07 Bedrock for 50 POSTs.

    end-to-end   Full user flow per iteration: POST /photos/upload, PUT
                 photo to S3, POST /photos/classify, POST /reports with
                 the AI values + photo_key. Each phase timed separately
                 ('e2e-upload', 'e2e-put-s3', 'e2e-classify', 'e2e-report')
                 plus a 'e2e-total' row. ~$0.10 Bedrock for 50 iterations
                 (photo classify is the heavy lift).

All raw timings stream to docs/data/scale-test-writepath.csv as soon as
they're measured, so a crash mid-run never loses data. Row 1 of each mode
is tagged cold=true (Lambda cold start + first SSM fetch + first psycopg2
connection); rest are warm. The CSV is the source for the chart script,
re-rendering after a run requires no re-execution.

Usage:
    python scale_test_writepath.py --mode db-only   --url https://api.terra.foad.dev
    python scale_test_writepath.py --mode with-text --url https://api.terra.foad.dev
    python scale_test_writepath.py --mode end-to-end --url https://api.terra.foad.dev \\
        --photo /path/to/test.jpg
"""

import argparse
import csv
import json
import statistics
import sys
import time
import urllib.request
import uuid
from pathlib import Path

EPICENTRE = (36.16, 36.21)
CSV_PATH = Path(__file__).resolve().parent.parent / "docs" / "data" / "scale-test-writepath.csv"


def payload_db_only() -> dict:
    return {
        "latitude": EPICENTRE[1],
        "longitude": EPICENTRE[0],
        "damage_level": "partial",
        "infrastructure_type": ["Residential Infrastructure (Houses and apartments)"],
        "crisis_nature": ["Earthquake"],
        "device_id": f"device-scale-write-{uuid.uuid4()}",
    }


def payload_with_text() -> dict:
    return {
        **payload_db_only(),
        "infrastructure_description": "Two-storey concrete building, north wall collapsed, debris blocking the street. Contact ahmet@example.com or call +90 555 123 4567.",
        "debris_present": True,
        "electricity_status": "Severe damage (major infrastructure damaged, prolonged outages)",
        "health_status": "Partially functional",
        "pressing_needs": [
            "Food assistance and safe drinking water",
            "Shelter, housing repair, or temporary accommodation",
        ],
    }


def payload_e2e(photo_key: str, ai: dict) -> dict:
    p = payload_with_text()
    p["photo_key"] = photo_key
    p["ai_damage_level"] = ai.get("damage_level")
    p["ai_infrastructure_type"] = ai.get("infrastructure_type")
    p["ai_confidence"] = ai.get("confidence")
    return p


def timed(fn):
    """Run fn(), return (elapsed_ms, status, body_or_none)."""
    t0 = time.perf_counter()
    try:
        status, body = fn()
    except urllib.error.HTTPError as e:
        status, body = e.code, None
    return (time.perf_counter() - t0) * 1000, status, body


def post_json(url: str, body: dict) -> tuple[int, dict | None]:
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.status, json.loads(resp.read() or "{}")


def put_bytes(url: str, content_type: str, payload: bytes) -> tuple[int, None]:
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": content_type}, method="PUT")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.status, None


def open_csv() -> csv.writer:
    is_new = not CSV_PATH.exists()
    f = open(CSV_PATH, "a", newline="")
    w = csv.writer(f)
    if is_new:
        w.writerow(["mode", "run", "ms", "status", "cold"])
    return w, f


def record(writer, fh, mode: str, run: int, ms: float, status: int, cold: bool):
    writer.writerow([mode, run, f"{ms:.3f}", status, str(cold).lower()])
    fh.flush()


def run_simple_mode(args, mode: str, payload_fn, writer, fh):
    print(f"--- {mode} ({args.count} POSTs) ---")
    for i in range(1, args.count + 1):
        ms, status, _ = timed(lambda: post_json(f"{args.url}/reports", payload_fn()))
        record(writer, fh, mode, i, ms, status, cold=(i == 1))
        if i == 1 or i % 10 == 0 or status >= 400:
            print(f"  [{i:2d}] {ms:>7.0f} ms  HTTP {status}")


def run_e2e(args, writer, fh):
    photo_bytes = Path(args.photo).read_bytes()
    print(f"--- end-to-end ({args.count} iterations, photo={args.photo}) ---")
    for i in range(1, args.count + 1):
        cold = (i == 1)
        t0 = time.perf_counter()

        # 1. /photos/upload
        ms, status, body = timed(lambda: post_json(f"{args.url}/photos/upload", {"content_type": "image/jpeg"}))
        record(writer, fh, "e2e-upload", i, ms, status, cold)
        if status >= 400 or not body:
            print(f"  [{i:2d}] upload failed HTTP {status}; skipping iteration")
            continue
        photo_key, upload_url = body["photo_key"], body["upload_url"]

        # 2. PUT photo to S3 (not via our API, but part of user-visible latency)
        ms, status, _ = timed(lambda: put_bytes(upload_url, "image/jpeg", photo_bytes))
        record(writer, fh, "e2e-put-s3", i, ms, status, cold)
        if status >= 400:
            print(f"  [{i:2d}] PUT failed HTTP {status}; skipping iteration")
            continue

        # 3. /photos/classify
        ms, status, ai = timed(lambda: post_json(f"{args.url}/photos/classify", {"photo_key": photo_key}))
        record(writer, fh, "e2e-classify", i, ms, status, cold)
        if status >= 400 or not ai:
            print(f"  [{i:2d}] classify failed HTTP {status}; skipping iteration")
            continue

        # 4. /reports with AI values
        ms, status, _ = timed(lambda: post_json(f"{args.url}/reports", payload_e2e(photo_key, ai)))
        record(writer, fh, "e2e-report", i, ms, status, cold)

        total_ms = (time.perf_counter() - t0) * 1000
        record(writer, fh, "e2e-total", i, total_ms, status, cold)
        if i == 1 or i % 10 == 0 or status >= 400:
            print(f"  [{i:2d}] total {total_ms:>7.0f} ms  last HTTP {status}")


def summarise(writer_path: Path):
    """Print percentiles for each mode currently in the CSV (warm only)."""
    rows = []
    with open(writer_path) as f:
        for row in csv.DictReader(f):
            if row["cold"] == "true":
                continue
            if int(row["status"]) >= 400:
                continue
            rows.append(row)
    by_mode = {}
    for r in rows:
        by_mode.setdefault(r["mode"], []).append(float(r["ms"]))
    print()
    print(f"{'mode':14} {'n':>4} {'min':>6} {'p50':>6} {'p95':>6} {'p99':>6} {'max':>6} {'mean':>6}")
    for mode, vals in sorted(by_mode.items()):
        if not vals:
            continue
        s = sorted(vals)
        def pct(p):
            return s[min(int(len(s) * p / 100), len(s) - 1)]
        print(f"{mode:14} {len(vals):>4} {min(vals):>6.0f} {pct(50):>6.0f} {pct(95):>6.0f} {pct(99):>6.0f} {max(vals):>6.0f} {statistics.mean(vals):>6.0f}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True, help="API base URL (no trailing slash)")
    parser.add_argument("--mode", required=True, choices=["db-only", "with-text", "end-to-end"])
    parser.add_argument("--count", type=int, default=50)
    parser.add_argument("--photo", help="Path to JPEG; required for end-to-end")
    args = parser.parse_args()

    if args.mode == "end-to-end" and not args.photo:
        parser.error("--photo required for --mode end-to-end")
        sys.exit(2)

    writer, fh = open_csv()
    try:
        if args.mode == "db-only":
            run_simple_mode(args, "db-only", payload_db_only, writer, fh)
        elif args.mode == "with-text":
            run_simple_mode(args, "with-text", payload_with_text, writer, fh)
        elif args.mode == "end-to-end":
            run_e2e(args, writer, fh)
    finally:
        fh.close()

    summarise(CSV_PATH)


if __name__ == "__main__":
    main()
