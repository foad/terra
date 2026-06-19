"""Generate synthetic reports at scale (default 500k) as CSV for COPY.

The challenge brief's scale targets are 50k (local), 250k (regional) and
500k (national) reports per crisis. This produces a CSV that loads in
minutes via COPY — INSERT statements do not scale to these row counts.

Usage:
    python generate_scale_test.py --rows 500000
    # then, against a DISPOSABLE test instance (never the demo DB):
    #   \\copy reports (id, location, h3_r12, h3_r8, building_id,
    #       damage_level, infrastructure_type, infrastructure_description,
    #       crisis_nature, debris_present, electricity_status,
    #       health_status, pressing_needs, version_chain_id,
    #       is_latest, device_id, submitted_at)
    #       FROM 'scale_test_reports.csv' WITH (FORMAT csv)
    # then run scale_test_queries.sql with \\timing on.

Teardown: DELETE FROM reports WHERE device_id LIKE 'device-scale-%';
"""

import argparse
import csv
import math
import random
import uuid
from datetime import datetime, timedelta

import h3

BBOX = {"west": 36.10, "east": 36.22, "south": 36.17, "north": 36.25}
EPICENTRE = (36.16, 36.21)
ZONES = {
    "centre": (0.40, 0.012, [0.10, 0.20, 0.70]),
    "ring": (0.35, 0.030, [0.20, 0.60, 0.20]),
    "periphery": (0.25, 0.055, [0.70, 0.20, 0.10]),
}
DAMAGE_LEVELS = ["minimal", "partial", "complete"]

INFRASTRUCTURE_TYPES = [
    "Residential Infrastructure (Houses and apartments)",
    "Commercial Infrastructure (Markets, malls, shops, hotels, banks, industries, etc.)",
    "Government Building (Administrative buildings, courthouses, police stations, fire stations, etc.)",
    "Utility Infrastructure (Water pumps, power plants, waste treatment plants, etc.)",
    "Transport and Communication Infrastructure (Roads, cell towers, bridges, railway station, bus station, etc.)",
    "Community Infrastructure (Schools, hospitals, community halls, public toilets, etc.)",
    "Public spaces/Recreation Infrastructure (stadiums, playgrounds, religious buildings, etc.)",
]
INFRA_WEIGHTS = [0.35, 0.15, 0.1, 0.1, 0.1, 0.1, 0.1]

ELECTRICITY = [
    "No damage observed",
    "Moderate damage (partial outages requiring repairs)",
    "Severe damage (major infrastructure damaged, prolonged outages)",
]
HEALTH = ["Fully functional", "Partially functional", "Largely disrupted"]
NEEDS = [
    "Food assistance and safe drinking water",
    "Shelter, housing repair, or temporary accommodation",
    "Restoration of basic services and infrastructure (electricity, roads, schools)",
]

BASE_TIME = datetime(2026, 4, 5, 8, 0, 0)
random.seed(0x5CA1E)


def pg_array(items):
    return "{" + ",".join('"' + i.replace('"', '\\"') + '"' for i in items) + "}"


def generate(path: str, rows: int) -> None:
    zone_names = list(ZONES)
    zone_shares = [ZONES[n][0] for n in zone_names]

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        for i in range(rows):
            zone = random.choices(zone_names, weights=zone_shares, k=1)[0]
            zone_idx = zone_names.index(zone)
            inner = 0.0 if zone_idx == 0 else ZONES[zone_names[zone_idx - 1]][1]
            outer = ZONES[zone][1]
            angle = random.uniform(0, 2 * math.pi)
            radius = random.uniform(inner, outer)
            lng = min(BBOX["east"], max(BBOX["west"], EPICENTRE[0] + radius * math.cos(angle)))
            lat = min(BBOX["north"], max(BBOX["south"], EPICENTRE[1] + radius * math.sin(angle) * 0.8))

            damage = random.choices(DAMAGE_LEVELS, weights=ZONES[zone][2], k=1)[0]
            infra = random.choices(INFRASTRUCTURE_TYPES, weights=INFRA_WEIGHTS, k=1)[0]

            r = random.random()
            if r < 0.6:
                hours = random.uniform(0, 6)
            elif r < 0.9:
                hours = random.uniform(6, 48)
            else:
                hours = random.uniform(48, 120)
            submitted = BASE_TIME + timedelta(hours=hours)

            # 50% of reports tap a building (VIDA footprint id); rest are manual pins.
            # Pool of 50k building ids → ~5 reports per building on average, with
            # natural clustering by zone for the reassessment-shaped distribution.
            building_id = f"vida-{random.randint(1, 50000)}" if random.random() < 0.5 else ""

            writer.writerow([
                str(uuid.uuid4()),
                f"SRID=4326;POINT({lng:.6f} {lat:.6f})",
                h3.latlng_to_cell(lat, lng, 12),
                h3.latlng_to_cell(lat, lng, 8),
                building_id,
                damage,
                pg_array([infra]),
                "",
                pg_array(["Earthquake"]),
                "t" if damage == "complete" else "f",
                random.choice(ELECTRICITY),
                random.choice(HEALTH),
                pg_array(random.sample(NEEDS, k=random.randint(1, 3))),
                str(uuid.uuid4()),
                "t",
                f"device-scale-{random.randint(1, 5000)}",
                submitted.isoformat() + "+00",
            ])
            if (i + 1) % 100_000 == 0:
                print(f"  {i + 1:,} rows...")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate scale-test report CSV")
    parser.add_argument("--rows", type=int, default=500_000)
    parser.add_argument("--out", default="scale_test_reports.csv")
    args = parser.parse_args()
    generate(args.out, args.rows)
    print(f"Generated {args.out} ({args.rows:,} rows)")
