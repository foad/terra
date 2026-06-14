# AI Damage Classification — Rubric and Assumptions

TERRA uses a vision AI model to analyse submitted photos and suggest a damage level and infrastructure category. Classification is advisory-only: the human assessor always makes the final call, and classification failure never blocks a submission.

---

## Damage Tier Rubric

Three tiers map directly to the RAPIDA severity scale:

| Tier | Label | Visual criteria |
|------|-------|-----------------|
| 1 | **Minimal** | Structure is sound and functional. Only cosmetic damage (surface cracks, broken windows, scattered minor debris) or no visible damage. Safe to occupy without restriction. |
| 2 | **Partial** | Structural damage is present but the building retains load-bearing capacity and is usable with caution. Indicators: significant cracking of load-bearing walls, partial roof loss, visible deformation of framing, localised collapse of non-structural elements. |
| 3 | **Complete** | Structurally unsafe or destroyed. Indicators: full or near-full collapse of roof or load-bearing walls, building pancaked or leaning severely, imminent collapse risk, total destruction with only rubble remaining. |

The model assesses the dominant structural condition visible in the frame. It is instructed to evaluate the whole structure rather than the most damaged element in isolation.

---

## Infrastructure Categories

Seven categories are supported; multiple may apply to a single building:

| Key | Examples |
|-----|----------|
| `residential` | Houses, apartments |
| `commercial` | Markets, shops, hotels, banks, industrial buildings |
| `government` | Administrative buildings, courthouses, police/fire stations |
| `utility` | Water pumps, power plants, waste treatment |
| `transport` | Roads, bridges, cell towers, railway/bus stations |
| `community` | Schools, hospitals, community halls, public toilets |
| `publicSpaces` | Stadiums, playgrounds, religious buildings |

---

## Confidence Scores

The model returns two independent confidence scores (0.0–1.0): one for the damage level and one for the infrastructure category.

- **0.0**: high uncertainty — e.g. poor angle, smoke, debris obscuring the structure.
- **1.0**: high certainty.

A threshold of **0.6** is applied in the community PWA:
- **≥ 0.6**: the AI suggestion is pre-selected in the survey form as a starting point.
- **< 0.6**: the AI result is available but no pre-selection is made; the assessor chooses without a default.

Both confidence values are stored on every report record regardless of threshold, enabling downstream accuracy analysis.

---

## Advisory-Only Behaviour

1. Classification fires as a non-blocking background call as soon as a photo is uploaded.
2. The assessor can override any pre-selected value before submitting.
3. The final `damage_level` on the report always reflects the assessor's explicit choice.
4. The AI suggestion is stored separately as `ai_damage_level` / `ai_confidence` to allow accuracy tracking over time.

The assessor's judgement is always authoritative.

---

## Failure Modes

Classification failure is silent and never prevents a report from being submitted:

| Failure | Cause | Outcome |
|---------|-------|---------|
| Throttling | Bedrock API rate limit exceeded | AI fields stored as null; submission proceeds |
| Model error | Model did not call the classification tool, or returned an invalid structure | AI fields stored as null; submission proceeds |
| Photo unavailable | S3 object not yet readable at classification time | AI fields stored as null; submission proceeds |
| Network / timeout | Frontend request exceeds the classification timeout | AI fields stored as null; submission proceeds |

In all cases the assessor's own damage selection is used, and the report submits normally.

---

## Model Architecture

Implemented in [`backend/src/handlers/classify.py`](../backend/src/handlers/classify.py).

**Current model:** `anthropic.claude-haiku-4-5-20251001-v1:0` via AWS Bedrock (fast, low-cost per call).

**Swappable via environment variable:** setting `BEDROCK_MODEL_ID` to any Bedrock model that supports vision and tool use replaces the model without code changes. Candidates tested against this interface include Claude Sonnet (higher accuracy, higher cost) and Claude 3 Opus.

**Open-source swap path:** the classifier uses Bedrock's standard `converse` API with a JSON tool schema and `toolChoice.tool` forcing. Any vision model exposed through a Bedrock-compatible API (e.g. a self-hosted LLaVA or InternVL instance behind a Bedrock proxy) is a drop-in replacement — the surrounding submission pipeline, confidence thresholding, and failure-handling code require no changes.

**Tool forcing** (`toolChoice: { tool: { name: "submit_classification" } }`) constrains the model to return a structured JSON object rather than free text, eliminating format parsing and making output validation deterministic.

**Separation of concerns:** `/photos/classify` (POST) is a separate endpoint from `/reports` (POST). Classification can fail, time out, or be skipped without affecting report storage.
