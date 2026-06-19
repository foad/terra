"""Render read-path query timings across the brief's scale targets
(50k / 250k / 500k reports per crisis) as two separate PNGs.

Reads docs/data/scale-test-timings.csv (committed alongside this script
so the chart is reproducible without re-running the DB queries).
UNDP design-system palette.

Usage:
    uv run --with matplotlib python db/plot_scale.py
"""

import csv
import statistics
from collections import defaultdict
from pathlib import Path

import matplotlib.pyplot as plt


REPO = Path(__file__).resolve().parent.parent
CSV_PATH = REPO / "docs" / "data" / "scale-test-timings.csv"

HOT_PATHS = {
    "01-count-is-latest":     ("Total report count",         "#006eb5"),
    "04-gin-infra-type":      ("Filter by building type",    "#d12800"),
    "06-bbox-count":          ("Reports in map viewport",    "#59ba47"),
    "08-building-id-filter":  ("Look up a single building",  "#fbc412"),
}

HEAVY = {
    "05-h3-r8-aggregate":     ("Heatmap aggregation",        "#006eb5"),
    "11-export-1m":           ("Full data export",           "#d12800"),
}


def load_csv() -> dict[int, dict[str, list[float]]]:
    data: dict[int, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    with open(CSV_PATH) as f:
        for row in csv.DictReader(f):
            data[int(row["scale"])][row["query"]].append(float(row["ms"]))
    return data


def p(values: list[float], pct: int) -> float:
    if len(values) >= 100:
        return statistics.quantiles(values, n=100)[pct - 1]
    return sorted(values)[min(int(len(values) * pct / 100), len(values) - 1)]


def render_chart(queries: dict, title: str, out_path: Path, data, scales):
    fig, ax = plt.subplots(figsize=(8, 4.5), constrained_layout=True)

    for query_id, (label, colour) in queries.items():
        p50s = [p(data[s][query_id], 50) for s in scales]
        p95s = [p(data[s][query_id], 95) for s in scales]
        ax.plot(scales, p50s, "-o", color=colour, label=label, linewidth=2, markersize=6)
        ax.fill_between(scales, p50s, p95s, color=colour, alpha=0.12)

    ax.set_title(title, fontsize=14, weight="bold", color="#232e3d", loc="left", pad=12)
    ax.set_xlabel("Reports per crisis", fontsize=11, color="#55606e")
    ax.set_ylabel("p50 latency (ms)  ·  shaded band = p50–p95", fontsize=11, color="#55606e")
    ax.set_xticks(scales)
    ax.set_xticklabels([f"{s // 1000}k" for s in scales])
    ax.grid(True, axis="y", linestyle="--", linewidth=0.5, color="#d4d6d8")
    ax.set_axisbelow(True)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#84929d")
    ax.spines["bottom"].set_color("#84929d")
    ax.tick_params(colors="#55606e")
    ax.legend(loc="upper left", frameon=False, fontsize=10)
    ax.set_ylim(bottom=0)

    fig.savefig(out_path, dpi=150, bbox_inches="tight", facecolor="white")
    print(f"Saved {out_path}")


def main():
    data = load_csv()
    scales = sorted(data.keys())

    render_chart(HOT_PATHS, "Hot dashboard paths", REPO / "docs" / "scale-test-hot-paths.png", data, scales)
    render_chart(HEAVY, "Heavy queries", REPO / "docs" / "scale-test-heavy-queries.png", data, scales)


if __name__ == "__main__":
    main()
