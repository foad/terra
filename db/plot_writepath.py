"""Render write-path latency charts: db-only and DB+text-AI as two
separate PNGs (the two-orders-of-magnitude gap makes a shared axis
unreadable).

Reads docs/data/scale-test-writepath.csv (committed alongside this script
so the chart is reproducible without re-running the API). Warm samples
only (run #1 of each mode is tagged cold=true and shown separately in
the doc table). UNDP design-system palette.

Usage:
    uv run --with matplotlib python db/plot_writepath.py
"""

import csv
import random
from collections import defaultdict
from pathlib import Path

import matplotlib.pyplot as plt


REPO = Path(__file__).resolve().parent.parent
CSV_PATH = REPO / "docs" / "data" / "scale-test-writepath.csv"

CHARTS = [
    # (mode_id, title, colour, output_filename)
    ("db-only",   "Write-path latency: DB only (no free-text)",          "#006eb5", "scale-test-write-db-only.png"),
    ("with-text", "Write-path latency: DB + text AI (PII + translation)", "#d12800", "scale-test-write-text-ai.png"),
]


def percentile(values: list[float], p: int) -> float:
    s = sorted(values)
    return s[min(int(len(s) * p / 100), len(s) - 1)]


def load() -> dict[str, list[float]]:
    out = defaultdict(list)
    with open(CSV_PATH) as f:
        for row in csv.DictReader(f):
            if row["cold"] == "true":
                continue
            if int(row["status"]) >= 400:
                continue
            out[row["mode"]].append(float(row["ms"]))
    return out


def render_one(samples: list[float], title: str, colour: str, out_path: Path):
    p50 = percentile(samples, 50)
    p95 = percentile(samples, 95)
    p99 = percentile(samples, 99)

    fig, ax = plt.subplots(figsize=(9, 2.4), constrained_layout=True)
    y = 0

    random.seed(0)
    ys = [y + random.uniform(-0.22, 0.22) for _ in samples]
    ax.scatter(samples, ys, color=colour, alpha=0.30, s=24, edgecolors="none")

    ax.barh(y, p95 - p50, left=p50, height=0.50, color=colour, alpha=0.5, edgecolor="none")
    ax.vlines(p50, y - 0.27, y + 0.27, color=colour, linewidth=2.5)
    ax.vlines(p99, y - 0.27, y + 0.27, color=colour, linewidth=1.2, linestyle=":")

    ax.set_yticks([])
    ax.set_xlabel("Per-submission latency (ms)", fontsize=11, color="#55606e")
    ax.set_title(title, fontsize=13, weight="bold", color="#232e3d", loc="left", pad=10)
    ax.grid(True, axis="x", linestyle="--", linewidth=0.5, color="#d4d6d8")
    ax.set_axisbelow(True)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_visible(False)
    ax.spines["bottom"].set_color("#84929d")
    ax.tick_params(colors="#55606e")
    ax.set_xlim(left=0, right=p99 * 1.20)
    ax.set_ylim(-0.6, 0.6)

    # numeric labels centred above the bar
    ax.text(
        p99 * 1.15,
        y,
        f"p50 {p50:.0f}  ·  p95 {p95:.0f}  ·  p99 {p99:.0f}  ms",
        va="center",
        ha="right",
        color="#232e3d",
        fontsize=10,
    )

    fig.savefig(out_path, dpi=150, bbox_inches="tight", facecolor="white")
    print(f"Saved {out_path}")


def main():
    data = load()
    for mode_id, title, colour, filename in CHARTS:
        render_one(data[mode_id], title, colour, REPO / "docs" / filename)


if __name__ == "__main__":
    main()
