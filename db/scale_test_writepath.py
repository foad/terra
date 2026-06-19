"""Fire 50 sequential POSTs at the deployed /reports endpoint and measure
per-submission latency. Run twice for #200:

    # DB-only — empty free-text, no photo_key. PII filter (#156) and
    # translation (#153) short-circuit on empty input; photo classify
    # skipped without a key. Measures the pure DB write path.
    python scale_test_writepath.py --mode db-only --url https://api.terra.foad.dev

    # Full pipeline — realistic free-text + a pre-uploaded photo_key.
    # Hits PII, translation, and photo classify. Documents realistic
    # per-submission latency. ~$0.04 Bedrock for 50 POSTs.
    python scale_test_writepath.py --mode full \\
        --url https://api.terra.foad.dev \\
        --photo-key uploads/<existing-uuid>.jpg

Reports p50/p95/p99 + Bedrock spend reminder.
"""

import argparse
import json
import statistics
import time
import urllib.request
import uuid

EPICENTRE = (36.16, 36.21)


def payload_db_only() -> dict:
    return {
        "latitude": EPICENTRE[1],
        "longitude": EPICENTRE[0],
        "damage_level": "partial",
        "infrastructure_type": ["Residential Infrastructure (Houses and apartments)"],
        "crisis_nature": ["Earthquake"],
        "device_id": f"device-scale-write-{uuid.uuid4()}",
    }


def payload_full(photo_key: str) -> dict:
    return {
        "latitude": EPICENTRE[1],
        "longitude": EPICENTRE[0],
        "damage_level": "partial",
        "photo_key": photo_key,
        "infrastructure_type": ["Residential Infrastructure (Houses and apartments)"],
        "infrastructure_description": "Two-storey concrete building, north wall collapsed, debris blocking the street. Contact ahmet@example.com.",
        "crisis_nature": ["Earthquake"],
        "debris_present": True,
        "electricity_status": "Severe damage (major infrastructure damaged, prolonged outages)",
        "health_status": "Partially functional",
        "pressing_needs": [
            "Food assistance and safe drinking water",
            "Shelter, housing repair, or temporary accommodation",
        ],
        "device_id": f"device-scale-write-{uuid.uuid4()}",
    }


def fire(url: str, body: dict) -> tuple[float, int]:
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{url}/reports", data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            resp.read()
            status = resp.status
    except urllib.error.HTTPError as e:
        status = e.code
    return (time.perf_counter() - t0) * 1000, status


def percentile(values: list[float], p: float) -> float:
    return statistics.quantiles(values, n=100)[int(p) - 1] if len(values) >= 100 else sorted(values)[int(len(values) * p / 100)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True, help="API base URL (no trailing slash)")
    parser.add_argument("--mode", required=True, choices=["db-only", "full"])
    parser.add_argument("--count", type=int, default=50)
    parser.add_argument("--photo-key", help="Required for --mode full")
    args = parser.parse_args()

    if args.mode == "full" and not args.photo_key:
        parser.error("--photo-key required for --mode full")

    build = payload_db_only if args.mode == "db-only" else (lambda: payload_full(args.photo_key))

    latencies = []
    errors = 0
    print(f"Firing {args.count} {args.mode} POSTs at {args.url}/reports...")
    for i in range(args.count):
        ms, status = fire(args.url, build())
        if status >= 400:
            errors += 1
            print(f"  [{i + 1}] HTTP {status} ({ms:.0f} ms)")
        else:
            latencies.append(ms)
            if (i + 1) % 10 == 0:
                print(f"  [{i + 1}] {ms:.0f} ms")

    if not latencies:
        print("No successful requests; aborting stats.")
        return

    print()
    print(f"mode:    {args.mode}")
    print(f"count:   {len(latencies)} ok, {errors} errors")
    print(f"min:     {min(latencies):.0f} ms")
    print(f"p50:     {percentile(latencies, 50):.0f} ms")
    print(f"p95:     {percentile(latencies, 95):.0f} ms")
    print(f"p99:     {percentile(latencies, 99):.0f} ms")
    print(f"max:     {max(latencies):.0f} ms")
    print(f"mean:    {statistics.mean(latencies):.0f} ms")
    if args.mode == "full":
        print(f"Bedrock: ~${0.0008 * len(latencies):.3f} for this run (Haiku 4.5 estimate)")


if __name__ == "__main__":
    main()
