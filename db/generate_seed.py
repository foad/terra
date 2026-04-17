"""Generate seed SQL for demo data in Hatay, Turkey earthquake zone."""

import random
import uuid
from datetime import datetime, timedelta

import h3

# Hatay, Turkey bounding box
BBOX = {
    "west": 36.10,
    "east": 36.22,
    "south": 36.17,
    "north": 36.25,
}

DAMAGE_LEVELS = ["minimal", "partial", "complete"]
DAMAGE_WEIGHTS = [0.2, 0.6, 0.2]

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

INFRA_NAMES = {
    "Residential Infrastructure (Houses and apartments)": [None, None, None, "Apartment Block 14", "Hilal Residences"],
    "Commercial Infrastructure (Markets, malls, shops, hotels, banks, industries, etc.)": ["Central Market", "Hatay Grand Hotel", "Bazaar District", None],
    "Government Building (Administrative buildings, courthouses, police stations, fire stations, etc.)": ["District Administration Office", "Fire Station No. 3", None],
    "Utility Infrastructure (Water pumps, power plants, waste treatment plants, etc.)": ["Water Treatment Plant", "Electricity Substation", None],
    "Transport and Communication Infrastructure (Roads, cell towers, bridges, railway station, bus station, etc.)": ["Hatay Bus Terminal", "Cell Tower Site 7", None],
    "Community Infrastructure (Schools, hospitals, community halls, public toilets, etc.)": ["Hatay Primary School", "Hatay General Hospital", "Community Hall", None],
    "Public spaces/Recreation Infrastructure (stadiums, playgrounds, religious buildings, etc.)": ["Friday Mosque", "City Park", None],
}

ELECTRICITY_OPTIONS = [
    "No damage observed",
    "Minor damage (service disruptions but quickly repairable)",
    "Moderate damage (partial outages requiring repairs)",
    "Severe damage (major infrastructure damaged, prolonged outages)",
    "Completely destroyed (no electricity infrastructure functioning)",
    "Unknown/cannot be assessed",
]

HEALTH_OPTIONS = [
    "Fully functional",
    "Partially functional",
    "Largely disrupted",
    "Not functioning at all",
    "Unknown",
]

PRESSING_NEEDS = [
    "Food assistance and safe drinking water",
    "Cash or financial assistance",
    "Access to healthcare and essential medicines",
    "Shelter, housing repair, or temporary accommodation",
    "Restoration of livelihoods or income sources",
    "Water, sanitation, and hygiene (toilets, washing facilities)",
    "Restoration of basic services and infrastructure (electricity, roads, schools)",
    "Protection services and psychosocial support",
    "Support from local authorities and community organizations",
]

BASE_TIME = datetime(2026, 4, 5, 8, 0, 0)
random.seed(0xf0ad)


def random_point():
    """Generate a random point biased toward the centre of the bbox using a normal distribution."""
    center_lng = (BBOX["west"] + BBOX["east"]) / 2
    center_lat = (BBOX["south"] + BBOX["north"]) / 2
    spread_lng = (BBOX["east"] - BBOX["west"]) / 6
    spread_lat = (BBOX["north"] - BBOX["south"]) / 6

    lng = max(BBOX["west"], min(BBOX["east"], random.gauss(center_lng, spread_lng)))
    lat = max(BBOX["south"], min(BBOX["north"], random.gauss(center_lat, spread_lat)))
    return lng, lat


def random_damage():
    return random.choices(DAMAGE_LEVELS, weights=DAMAGE_WEIGHTS, k=1)[0]


def damage_correlated_fields(damage):
    """Generate electricity/health/needs that correlate with damage level."""
    if damage == "minimal":
        elec = random.choice(ELECTRICITY_OPTIONS[:2])
        health = random.choice(HEALTH_OPTIONS[:2])
        needs = random.sample(PRESSING_NEEDS, k=random.randint(1, 2))
        debris = False
    elif damage == "partial":
        elec = random.choice(ELECTRICITY_OPTIONS[1:4])
        health = random.choice(HEALTH_OPTIONS[1:3])
        needs = random.sample(PRESSING_NEEDS, k=random.randint(2, 4))
        debris = random.choice([True, True, False])
    else:
        elec = random.choice(ELECTRICITY_OPTIONS[3:5])
        health = random.choice(HEALTH_OPTIONS[2:4])
        needs = random.sample(PRESSING_NEEDS, k=random.randint(3, 5))
        debris = True
    return elec, health, needs, debris


def random_infra():
    infra = random.choices(INFRASTRUCTURE_TYPES, weights=INFRA_WEIGHTS, k=1)[0]
    name = random.choice(INFRA_NAMES[infra])
    return infra, name


def sql_array(items):
    escaped = [f'"{item}"' for item in items]
    return "'{" + ",".join(escaped) + "}'"


def sql_str(val):
    if val is None:
        return "NULL"
    return "'" + val.replace("'", "''") + "'"


def generate(
    num_locations: int = 35,
    num_versioned: int = 5,
    versions_range: tuple[int, int] = (2, 3),
):
    """Generate seed SQL.

    Args:
        num_locations: Total unique building locations
        num_versioned: How many of those get multiple reports (version chains)
        versions_range: (min, max) number of reports per versioned location
    """
    assert num_versioned <= num_locations, "num_versioned must be <= num_locations"

    lines = [
        "-- Auto-generated seed data for Hatay, Turkey demo",
        "-- Run db/seed_teardown.sql to remove",
        f"-- Generated by db/generate_seed.py ({num_locations} locations, {num_versioned} versioned)",
        "",
        "INSERT INTO reports (",
        "    id, location, h3_r12, h3_r8, s2_id, location_description,",
        "    damage_level, infrastructure_type, infrastructure_name,",
        "    crisis_nature, debris_present, electricity_status,",
        "    health_status, pressing_needs, version_chain_id,",
        "    is_latest, device_id, submitted_at",
        ") VALUES",
    ]

    values = []

    locations = []
    for _ in range(num_locations):
        lng, lat = random_point()
        h3_r12 = h3.latlng_to_cell(lat, lng, 12)
        h3_r8 = h3.latlng_to_cell(lat, lng, 8)
        locations.append((lng, lat, h3_r12, h3_r8))

    # First num_versioned locations get version chains
    report_idx = 0
    for loc_idx in range(num_versioned):
        lng, lat, h3_r12, h3_r8 = locations[loc_idx]
        chain_id = str(uuid.uuid4())
        infra, infra_name = random_infra()
        num_versions = random.randint(versions_range[0], versions_range[1])

        # Damage escalates or stays stable
        if random.random() < 0.6:
            # Escalating
            damage_seq = sorted(
                [random_damage() for _ in range(num_versions)],
                key=lambda d: DAMAGE_LEVELS.index(d),
            )
        else:
            # Stable
            d = random_damage()
            damage_seq = [d] * num_versions

        for v in range(num_versions):
            report_id = str(uuid.uuid4())
            damage = damage_seq[v]
            elec, health, needs, debris = damage_correlated_fields(damage)
            submitted = BASE_TIME + timedelta(
                hours=random.randint(0, 24 * loc_idx),
                minutes=random.randint(0, 59),
            ) + timedelta(days=v * 2)
            device = f"device-seed-{random.randint(1, 15)}"

            # Small offset for repeated reports at same building
            jitter_lng = lng + random.uniform(-0.0001, 0.0001) if v > 0 else lng
            jitter_lat = lat + random.uniform(-0.0001, 0.0001) if v > 0 else lat

            val = (
                f"({sql_str(report_id)},\n"
                f" ST_SetSRID(ST_MakePoint({jitter_lng:.6f}, {jitter_lat:.6f}), 4326),\n"
                f" {sql_str(h3_r12)}, {sql_str(h3_r8)}, NULL, NULL,\n"
                f" {sql_str(damage)}, ARRAY[{sql_str(infra)}], {sql_str(infra_name)},\n"
                f" ARRAY['Earthquake'], {str(debris).lower()}, {sql_str(elec)},\n"
                f" {sql_str(health)}, {sql_array(needs)},\n"
                f" {sql_str(chain_id)}, false,\n"
                f" {sql_str(device)}, '{submitted.isoformat()}+00')"
            )
            values.append(val)
            report_idx += 1

    # Remaining locations: single reports
    for loc_idx in range(num_versioned, num_locations):
        lng, lat, h3_r12, h3_r8 = locations[loc_idx]
        report_id = str(uuid.uuid4())
        chain_id = str(uuid.uuid4())
        damage = random_damage()
        infra, infra_name = random_infra()
        elec, health, needs, debris = damage_correlated_fields(damage)
        submitted = BASE_TIME + timedelta(
            hours=random.randint(0, 120),
            minutes=random.randint(0, 59),
        )
        device = f"device-seed-{random.randint(1, 15)}"

        val = (
            f"({sql_str(report_id)},\n"
            f" ST_SetSRID(ST_MakePoint({lng:.6f}, {lat:.6f}), 4326),\n"
            f" {sql_str(h3_r12)}, {sql_str(h3_r8)}, NULL, NULL,\n"
            f" {sql_str(damage)}, ARRAY[{sql_str(infra)}], {sql_str(infra_name)},\n"
            f" ARRAY['Earthquake'], {str(debris).lower()}, {sql_str(elec)},\n"
            f" {sql_str(health)}, {sql_array(needs)},\n"
            f" {sql_str(chain_id)}, false,\n"
            f" {sql_str(device)}, '{submitted.isoformat()}+00')"
        )
        values.append(val)

    lines.append(",\n\n".join(values) + ";")

    # Fix up is_latest: set to true for the most recent report per version chain
    lines.append("")
    lines.append("-- Set is_latest for the most recent report in each version chain")
    lines.append(
        "UPDATE reports SET is_latest = true "
        "WHERE id IN ("
        "  SELECT DISTINCT ON (version_chain_id) id FROM reports "
        "  WHERE device_id LIKE 'device-seed-%' "
        "  ORDER BY version_chain_id, submitted_at DESC"
        ");"
    )

    return "\n".join(lines)


if __name__ == "__main__":
    import argparse
    import os

    parser = argparse.ArgumentParser(description="Generate seed SQL for TERRA demo data")
    parser.add_argument("--locations", type=int, default=35, help="Number of unique locations (default: 35)")
    parser.add_argument("--versioned", type=int, default=5, help="Number of locations with version chains (default: 5)")
    parser.add_argument("--min-versions", type=int, default=2, help="Min reports per versioned location (default: 2)")
    parser.add_argument("--max-versions", type=int, default=3, help="Max reports per versioned location (default: 3)")
    args = parser.parse_args()

    sql = generate(
        num_locations=args.locations,
        num_versioned=args.versioned,
        versions_range=(args.min_versions, args.max_versions),
    )
    out_path = os.path.join(os.path.dirname(__file__), "seed.sql")
    with open(out_path, "w") as f:
        f.write(sql + "\n")

    total_reports = args.versioned * ((args.min_versions + args.max_versions) // 2) + (args.locations - args.versioned)
    print(f"Generated {out_path} (~{total_reports} reports, {args.locations} locations, {args.versioned} versioned)")
