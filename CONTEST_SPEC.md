# InnoCentive / UNDP Challenge — Full Specification

**Challenge:** UNDP RAPIDA community damage assessment tool  
**Deadline:** June 23, 2026 (11:59 PM US Eastern)  
**Seeker:** UNDP (United Nations Development Programme)  
**Methodology context:** RAPIDA — Rapid Post-Crisis Integrated Digital Assessment

---

## What Evaluators Will Test

UNDP evaluators will independently access and test the live MVP. They will also review:
1. Written proposal (submitted form, not just attachments)
2. 2-minute pitch video / tutorial
3. The working prototype itself

Shortlisted solvers pitch directly to UNDP in a second phase.

---

## Must-Have Requirements (scored)

### 1 — Working App
A user-facing frontend + secure backend + dashboard.

**Frontend must have:**
- [ ] Accept photos, descriptions, damage classifications (smartphone / web)
- [ ] Interactive map with building footprint shapefiles overlaid
- [ ] Clear survey structure / submission format
- [ ] All 6 UN languages: AR, ZH, EN, FR, RU, ES
- [ ] Map auto-updates when connectivity available (new reports visible in near real-time to avoid duplication)

**Backend must have:**
- [ ] Collect, validate, store, export structured data
- [ ] Analytics on collected data
- [ ] Scale: 50k (local), 250k (regional), 500k (national) records per crisis
- [ ] Designed for hundreds of crises per year
- [ ] Secure database with sustained hosting

**Dashboard:**
- [ ] Map interface showing submissions with geolocation + damage classification

---

### 2 — 2-Minute Demo Video / Tutorial

Must demonstrate all three of:
- **Capture & Display:** photo input + damage classification → photo marked to building on map
- **Storage:** how hundreds of thousands of records are stored securely and privately
- **Export:** structured data export for crisis response analysis

---

### 3 — Engagement Incentivization (non-monetary)
Innovative features to incentivize engagement **without** encouraging repeat submissions or bad actors.

---

### 4 — Offline Functionality
Work in low/no connectivity. "Upload now, send later" queue for imagery.

---

### 5 — Multilingual Support
Handle and translate local language content. Open-source tools encouraged.

---

### 6 — Geolocation with Building Footprints
- Building footprints on map overlay for unambiguous identification (GPS alone is insufficient)
- **Preference** for textual location description when GPS unavailable (landmark-based)

---

### 7 — Secure Data Handling
Compliance with global data security standards and privacy practices.

---

## Required Form Fields (user-facing, must be in submission form)

### Core damage indicators (all required per submission):
- Date and time of data collection
- Photo of damaged infrastructure
- Damage classification: **Minimal/No damage | Partially damaged | Completely damaged**
- GPS coordinates or building-level identification

### Required multi-select questions:
**Type of infrastructure:**
- Residential (houses, apartments)
- Commercial (markets, malls, shops, hotels, banks, industries)
- Government building (admin, courthouses, police, fire stations)
- Utility (water pumps, power plants, waste treatment)
- Transport & Communication (roads, cell towers, bridges, railways, bus stations)
- Community (schools, hospitals, community halls, public toilets)
- Public spaces/Recreation (stadiums, playgrounds, religious buildings)
- Other (specify)

**Infrastructure name/details:** free text

**Nature of the crisis:**
- Natural: Earthquake | Flood | Tsunami | Hurricane/Cyclone | Wildfire
- Technological/industrial: Explosion | Chemical incident
- Human-made: Conflict | Civil unrest

**Debris clearing:** Is there any debris that requires clearing on or near the infrastructure site? (Y/N)

---

## Versioning Requirements
- Multiple reports for same building → system shows latest, most up-to-date (version chaining)
- Multiple reports in an area over time → grouping and prioritization by location/cluster

---

## Appendix 1 — Modular Follow-Up Questions
If the solution supports configurable form fields, these are of interest to UNDP:

**Electricity infrastructure condition:**
- No damage | Minor damage | Moderate damage | Severe damage | Completely destroyed | Unknown

**Health services functioning:**
- Fully functional | Partially functional | Largely disrupted | Not functioning | Unknown

**Most pressing needs (multi-select):**
- Food / safe water
- Cash / financial assistance
- Healthcare / medicines
- Shelter / housing repair / temporary accommodation
- Livelihoods / income
- WASH (toilets, washing)
- Basic services / infrastructure (electricity, roads, schools)
- Protection / psychosocial support
- Support from local authorities / community orgs
- Other (specify)

---

## Nice-to-Have (differentiators, may affect shortlisting)

1. **AI-powered features** — computer vision for damage classification, area analysis
2. **Rapid deployment story** — how deployed within 48 hours of a disaster; advertising / open-source support
3. **Redundancy/duplicate detection** — same timestamp, over-reporting
4. **Textual location description** — landmark-based location when no GPS ("near the school by the central market")

---

## Submission Requirements

### Written Proposal (form fields, ~500 words each):
1. Problem & Opportunity — innovation, point of difference, advantages
2. Solution Overview — features, frontend + backend design, database + export
3. Solution Feasibility — references, precedents, cost, usability by non-experts
4. Experience — expertise, use cases, skills
5. Solution Risks — risks and mitigation
6. Online References — links to publications / articles

### Attachments:
- MVP app (web URL or locally-usable files for evaluators)
- 2-minute video (Capture & Display + Storage + Export)

### Participation form also asks:
- Participation type (Individual or Organization)
- TRL level (minimum TRL 4)
- Interest in partnering

---

## TERRA Gap Analysis vs. Spec

### Fully built ✅
- Photo upload, damage classification, building footprint selection on map
- 6 UN languages (AR/ZH/EN/FR/RU/ES)
- Offline sync (IndexedDB queue, exponential backoff, reconnect)
- AI classification via AWS Bedrock — damage level + infrastructure type + confidence
- CSV + GeoJSON export
- Version chaining (multiple reports per building, `is_latest` flag)
- Duplicate + reassessment detection (PR #162)
- Dashboard heatmap, severity stats, spatial filters, export UI (PR #179)
- Photo privacy: EXIF strip, thumbnail, anonymous by default
- Modular follow-up questions (PR #165, requires migration 009)
- Community Activation Kit / QR + WhatsApp template (PR #172)
- Share with neighbours CTA on confirmation (PR #166/#173)

### Verify against actual form code ⚠️
- **Nature of crisis** question — is this user-selectable per report, or only admin-set at crisis creation?
- **Debris clearing** question — is this in the submission form?
- **Infrastructure type** — user selects from 7 categories, or is it AI-only?

### Gaps / opportunities 🔴
- **Engagement incentivization (must-have #3):** Share CTA is the main hook. Impact messaging (#53 — "your report helped X responders") would strengthen this scored criterion.
- **Textual/landmark location description (nice-to-have #4):** Not built. #153 exists for server-side translation of free-text descriptions, but landmark-based location input isn't there.
- **Analytics on collected data:** Dashboard shows spatial data. Explicit analytics view (e.g. damage breakdown by type, crisis timeline) would address the backend analytics requirement more directly.

### Dan's blockers (don't touch)
- #77 Demo environment — required for evaluators to test the live URL
- #155 Authentication — dashboard access control
