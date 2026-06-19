"""Generate seed SQL for demo data: Antakya earthquake (Türkiye) and
Pemba cyclone (Mozambique). Both crisis_events rows + their reports,
with reports linked to their crisis_event_id.

Usage:
    python db/generate_seed.py [--locations N --versioned M]
"""

import math
import os
import random
import uuid
from datetime import datetime, timedelta

import h3


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
INFRA_WEIGHTS = [0.35, 0.15, 0.10, 0.10, 0.10, 0.10, 0.10]

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


CRISES = [
    {
        "id": "605bc23d-74f1-4f28-89f3-46a9ec2e5eaa",
        "name": "Antakya Earthquake, Türkiye",
        "crisis_type": "Earthquake",
        "crisis_nature": "Earthquake",
        "region_wkt": "POLYGON((36.06776903 36.240169228,36.02810922 36.215086656,35.996683869 36.184506592,36.01701792 36.109870991,36.1066726 36.077008833,36.223131256 36.087466465,36.296148985 36.117337747,36.327354076 36.166005165,36.320373638 36.254243073,36.225992296 36.278631733,36.168403681 36.284258804,36.110815065 36.266907367,36.06776903 36.240169228))",
        "epicentre": (36.16, 36.18),
        "bbox": {"west": 35.99, "east": 36.33, "south": 36.07, "north": 36.29},
        "zones": {
            "centre":    (0.40, 0.012, [0.10, 0.20, 0.70]),
            "ring":      (0.35, 0.030, [0.20, 0.60, 0.20]),
            "periphery": (0.25, 0.055, [0.70, 0.20, 0.10]),
        },
        "base_time": datetime(2026, 4, 5, 8, 0, 0),
        "scale": 1.0,
        "infra_names": {
            "Residential Infrastructure (Houses and apartments)": [None, None, None, "Apartment Block 14", "Hilal Residences"],
            "Commercial Infrastructure (Markets, malls, shops, hotels, banks, industries, etc.)": ["Central Market", "Antakya Grand Hotel", "Bazaar District", None],
            "Government Building (Administrative buildings, courthouses, police stations, fire stations, etc.)": ["District Administration Office", "Fire Station No. 3", None],
            "Utility Infrastructure (Water pumps, power plants, waste treatment plants, etc.)": ["Water Treatment Plant", "Electricity Substation", None],
            "Transport and Communication Infrastructure (Roads, cell towers, bridges, railway station, bus station, etc.)": ["Antakya Bus Terminal", "Cell Tower Site 7", None],
            "Community Infrastructure (Schools, hospitals, community halls, public toilets, etc.)": ["Antakya Primary School", "Antakya General Hospital", "Community Hall", None],
            "Public spaces/Recreation Infrastructure (stadiums, playgrounds, religious buildings, etc.)": ["Friday Mosque", "City Park", None],
        },
    },
    {
        "id": "82c40b3d-1f96-4ff2-9a6b-1ad8f9b48a51",
        "name": "Cyclone response — Pemba, Mozambique",
        "crisis_type": "Hurricane/Cyclone",
        "crisis_nature": "Hurricane/Cyclone",
        "region_wkt": "POLYGON((40.38 -13.55, 40.65 -13.55, 40.65 -13.10, 40.38 -13.10, 40.38 -13.55))",
        "epicentre": (40.52, -13.32),
        "bbox": {"west": 40.38, "east": 40.65, "south": -13.55, "north": -13.10},
        "zones": {
            "centre":    (0.35, 0.025, [0.15, 0.30, 0.55]),
            "ring":      (0.40, 0.075, [0.30, 0.50, 0.20]),
            "periphery": (0.25, 0.130, [0.65, 0.25, 0.10]),
        },
        "base_time": datetime(2026, 4, 28, 14, 0, 0),
        "scale": 0.2,
        "infra_names": {
            "Residential Infrastructure (Houses and apartments)": [None, None, "Bairro Cariacó Apartments", "Pescadores Houses"],
            "Commercial Infrastructure (Markets, malls, shops, hotels, banks, industries, etc.)": ["Mercado Municipal", "Cariacó Market", "Praia do Wimbe Resort", None],
            "Government Building (Administrative buildings, courthouses, police stations, fire stations, etc.)": ["Pemba District Office", "Bombeiros de Pemba (Fire Station)", None],
            "Utility Infrastructure (Water pumps, power plants, waste treatment plants, etc.)": ["Power Substation", "Wastewater Treatment Works", None],
            "Transport and Communication Infrastructure (Roads, cell towers, bridges, railway station, bus station, etc.)": ["Pemba Port Authority", "Pemba Airport Terminal", "Cell Tower Site 12", None],
            "Community Infrastructure (Schools, hospitals, community halls, public toilets, etc.)": ["Pemba Central Hospital", "Community Centre — Paquitequete", None],
            "Public spaces/Recreation Infrastructure (stadiums, playgrounds, religious buildings, etc.)": ["Catholic Cathedral of Pemba", "Praça dos Heróis Park", None],
        },
    },
]


random.seed(0xf0ad)


def pick_zone(crisis):
    names = list(crisis["zones"])
    shares = [crisis["zones"][n][0] for n in names]
    return random.choices(names, weights=shares, k=1)[0]


def random_point(crisis, zone):
    zones = crisis["zones"]
    zone_idx = list(zones).index(zone)
    inner = 0.0 if zone_idx == 0 else zones[list(zones)[zone_idx - 1]][1]
    outer = zones[zone][1]
    angle = random.uniform(0, 2 * math.pi)
    radius = random.uniform(inner, outer)
    lng = crisis["epicentre"][0] + radius * math.cos(angle)
    lat = crisis["epicentre"][1] + radius * math.sin(angle) * 0.8
    bbox = crisis["bbox"]
    lng = max(bbox["west"], min(bbox["east"], lng))
    lat = max(bbox["south"], min(bbox["north"], lat))
    return lng, lat


def random_damage(crisis, zone):
    return random.choices(DAMAGE_LEVELS, weights=crisis["zones"][zone][2], k=1)[0]


def wave_time(crisis):
    r = random.random()
    if r < 0.6:
        hours = random.uniform(0, 6)
    elif r < 0.9:
        hours = random.uniform(6, 48)
    else:
        hours = random.uniform(48, 120)
    return crisis["base_time"] + timedelta(hours=hours)


def damage_correlated_fields(damage):
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


def random_infra(crisis):
    infra = random.choices(INFRASTRUCTURE_TYPES, weights=INFRA_WEIGHTS, k=1)[0]
    name = random.choice(crisis["infra_names"][infra])
    return infra, name


def sql_array(items):
    escaped = [f'"{item}"' for item in items]
    return "'{" + ",".join(escaped) + "}'"


def sql_str(val):
    if val is None:
        return "NULL"
    return "'" + val.replace("'", "''") + "'"


def emit_crisis_insert(crisis):
    return (
        "INSERT INTO crisis_events (id, name, crisis_type, region, is_active, follow_up_questions) VALUES (\n"
        f"    '{crisis['id']}',\n"
        f"    '{crisis['name']}',\n"
        f"    '{crisis['crisis_type']}',\n"
        f"    ST_SetSRID(ST_GeomFromText('{crisis['region_wkt']}'), 4326),\n"
        f"    true,\n"
        f"    '[]'::jsonb\n"
        ");"
    )


def emit_reports_for_crisis(crisis, num_locations, num_versioned, versions_range):
    lines = [
        f"-- Reports for {crisis['name']}",
        "INSERT INTO reports (",
        "    id, crisis_event_id, location, h3_r12, h3_r8, building_id,",
        "    damage_level, infrastructure_type, infrastructure_description,",
        "    crisis_nature, debris_present, electricity_status,",
        "    health_status, pressing_needs, version_chain_id,",
        "    is_latest, device_id, submitted_at",
        ") VALUES",
    ]
    values = []

    locations = []
    for _ in range(num_locations):
        zone = pick_zone(crisis)
        lng, lat = random_point(crisis, zone)
        h3_r12 = h3.latlng_to_cell(lat, lng, 12)
        h3_r8 = h3.latlng_to_cell(lat, lng, 8)
        locations.append((lng, lat, h3_r12, h3_r8, zone))

    for loc_idx in range(num_versioned):
        lng, lat, h3_r12, h3_r8, zone = locations[loc_idx]
        chain_id = str(uuid.uuid4())
        infra, infra_name = random_infra(crisis)
        num_versions = random.randint(versions_range[0], versions_range[1])

        if random.random() < 0.6:
            damage_seq = sorted(
                [random_damage(crisis, zone) for _ in range(num_versions)],
                key=lambda d: DAMAGE_LEVELS.index(d),
            )
        else:
            d = random_damage(crisis, zone)
            damage_seq = [d] * num_versions

        first_submitted = wave_time(crisis)
        for v in range(num_versions):
            report_id = str(uuid.uuid4())
            damage = damage_seq[v]
            elec, health, needs, debris = damage_correlated_fields(damage)
            submitted = first_submitted + timedelta(days=v * 2, minutes=random.randint(0, 59))
            device = f"device-seed-{random.randint(1, 15)}"
            jitter_lng = lng + random.uniform(-0.0001, 0.0001) if v > 0 else lng
            jitter_lat = lat + random.uniform(-0.0001, 0.0001) if v > 0 else lat

            val = (
                f"({sql_str(report_id)}, '{crisis['id']}',\n"
                f" ST_SetSRID(ST_MakePoint({jitter_lng:.6f}, {jitter_lat:.6f}), 4326),\n"
                f" {sql_str(h3_r12)}, {sql_str(h3_r8)}, NULL,\n"
                f" {sql_str(damage)}, ARRAY[{sql_str(infra)}], {sql_str(infra_name)},\n"
                f" ARRAY[{sql_str(crisis['crisis_nature'])}], {str(debris).lower()}, {sql_str(elec)},\n"
                f" {sql_str(health)}, {sql_array(needs)},\n"
                f" {sql_str(chain_id)}, false,\n"
                f" {sql_str(device)}, '{submitted.isoformat()}+00')"
            )
            values.append(val)

    for loc_idx in range(num_versioned, num_locations):
        lng, lat, h3_r12, h3_r8, zone = locations[loc_idx]
        report_id = str(uuid.uuid4())
        chain_id = str(uuid.uuid4())
        damage = random_damage(crisis, zone)
        infra, infra_name = random_infra(crisis)
        elec, health, needs, debris = damage_correlated_fields(damage)
        submitted = wave_time(crisis) + timedelta(minutes=random.randint(0, 59))
        device = f"device-seed-{random.randint(1, 15)}"

        val = (
            f"({sql_str(report_id)}, '{crisis['id']}',\n"
            f" ST_SetSRID(ST_MakePoint({lng:.6f}, {lat:.6f}), 4326),\n"
            f" {sql_str(h3_r12)}, {sql_str(h3_r8)}, NULL,\n"
            f" {sql_str(damage)}, ARRAY[{sql_str(infra)}], {sql_str(infra_name)},\n"
            f" ARRAY[{sql_str(crisis['crisis_nature'])}], {str(debris).lower()}, {sql_str(elec)},\n"
            f" {sql_str(health)}, {sql_array(needs)},\n"
            f" {sql_str(chain_id)}, false,\n"
            f" {sql_str(device)}, '{submitted.isoformat()}+00')"
        )
        values.append(val)

    lines.append(",\n\n".join(values) + ";")
    return "\n".join(lines)


def generate(num_locations=150, num_versioned=8, versions_range=(2, 3)):
    assert num_versioned <= num_locations, "num_versioned must be <= num_locations"

    lines = [
        "-- Auto-generated seed data for TERRA demo",
        "-- Run db/seed_teardown.sql to remove",
        f"-- Generated by db/generate_seed.py (Antakya: {num_locations} locations, {num_versioned} versioned)",
        "",
    ]
    for crisis in CRISES:
        lines.append(f"-- {crisis['name']}")
        lines.append(emit_crisis_insert(crisis))
        lines.append("")

    for crisis in CRISES:
        scale = crisis["scale"]
        locs = max(num_versioned, int(num_locations * scale))
        vers = max(1, int(num_versioned * scale))
        lines.append(emit_reports_for_crisis(crisis, locs, vers, versions_range))
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

    parser = argparse.ArgumentParser(description="Generate seed SQL for TERRA demo data")
    parser.add_argument("--locations", type=int, default=1000, help="Antakya unique locations (Pemba scales to 20%% of this)")
    parser.add_argument("--versioned", type=int, default=50, help="Antakya locations with version chains")
    parser.add_argument("--min-versions", type=int, default=2)
    parser.add_argument("--max-versions", type=int, default=3)
    args = parser.parse_args()

    sql = generate(
        num_locations=args.locations,
        num_versioned=args.versioned,
        versions_range=(args.min_versions, args.max_versions),
    )
    out_path = os.path.join(os.path.dirname(__file__), "seed.sql")
    with open(out_path, "w") as f:
        f.write(sql + "\n")
    print(f"Generated {out_path}")
