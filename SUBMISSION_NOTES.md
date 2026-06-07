# TERRA Submission Notes

Working document for demo prep and proposal writing.
Deadline: **23 June 2026**

---

## Quick Links

| What | URL |
|---|---|
| GitHub repo | https://github.com/foad/terra |
| Live app (community PWA) | _TBD — pending Dan's #77_ |
| Analyst dashboard | _TBD — pending Dan's #77_ |
| InnoCentive challenge page | _Add URL here_ |

---

## Submission Checklist

| Deliverable | Status | Notes |
|---|---|---|
| Live URL (evaluators will test independently) | Blocked on Dan #77 | Must be stable for ~2 weeks before deadline |
| 2-minute demo video | Not started | See script below |
| Written proposal (6 sections, ~500 words each) | Not started | See drafts below |

---

## Feature Inventory

_For each feature: what it does, whether it belongs in the **report**, the **video**, or **both**, and which scored criterion it addresses. Features marked (PR #N) are in open PRs pending Dan's merge._

### Show in video + mention in report

| Feature | Demo moment | Report angle | Scored req |
|---|---|---|---|
| Building footprint selection (VIDA) | User taps a building polygon — not a GPS pin drop | Unambiguous building-level ID; VIDA dataset global | Req #6 |
| AI damage classification (Claude Haiku) | Photo → damage level + infra type + confidence pre-selected | Computer vision for crisis assessment; advisory not prescriptive | Nice-to-have #1 |
| Offline submission queue | Submit with no connectivity → reconnect → report syncs automatically | IndexedDB queue, exponential backoff, works mid-disaster | Req #4 |
| Offline PMTiles map caching | Map tiles cached by service worker — works without internet | Same offline story; no separate download step | Req #4 |
| 6 UN language toggle | Switch language mid-flow (show AR or ES) | AR/ZH/EN/FR/RU/ES; i18next; keys in DB not translations | Req #5 |
| Community Activation Kit (PR #172) | Analyst creates crisis zone → generates QR + WhatsApp message → community scans and reports | 48-hour deployment story; no IT team required | Req #1 |
| Share with neighbours CTA (PR #173) | Post-submit confirmation → native share sheet on mobile (WhatsApp, SMS etc.) | Non-monetary viral loop; message includes active crisis name | Req #3 |
| Community coverage map (PR #183) | PWA map fills in as reports come in; gray outlines = unassessed buildings | Coverage gap is visible; directs reporters to gaps not repeats | Req #3 |
| Dashboard heatmap + stats bar (PR #179) | Analyst view: severity-weighted heatmap updates live; counts by damage level | "Capture & Display" requirement; analysts see density of damage | Req #2 + Req #1 |
| Export — GeoJSON + CSV | Analyst filters → exports structured data | "Export" requirement; 10k row cap (note honestly in proposal) | Req #2 |
| Report pinned to building on map | Submitted report appears as coloured marker on analyst dashboard | "Capture & Display" — report marked to building | Req #2 |

### Mention in report only

| Feature | Report angle | Scored req |
|---|---|---|
| PostGIS + H3 spatial indexing (R12 granular, R8 aggregation) | Designed for 500k records per crisis, hundreds of crises/year; not raw bounding box | Req #1 (scale) |
| Version chaining (`is_latest` DB trigger) | Multiple reports for same building handled correctly; always query latest | Scored versioning req |
| Duplicate/reassessment detection (PR #162) | Same building = reassessment; same location <15m <2min = duplicate; both flagged not dropped | Nice-to-have #3 |
| Photo EXIF stripping + anonymous by default | No GPS metadata leaves the server; no account required | Req #7 (privacy/security) |
| Analyst-configured follow-up questions (PR #165) | Crisis-specific questions (electricity, health, pressing needs) stored as JSONB — flexible not fixed columns | Appendix questions from spec all present |
| Admin crisis event CRUD + polygon region editor | Analyst draws a crisis zone on a map; sets crisis type and name | Req #1 (analyst side) |
| Report detail modal on dashboard | Click any map pin → full report detail including photo, AI classification, survey answers | Req #1 (dashboard depth) |
| Markers / Heatmap / Both toggle (PR #179) | Analyst chooses view mode; both overlaid for dense areas | Req #1 (dashboard flexibility) |
| 9 E2E Playwright tests + CI pipeline | Automated tests run on every PR; backend + frontend + e2e coverage | Req #1 (code quality / feasibility) |
| Lambda + API Gateway + PostGIS/Supabase + S3 + CloudFront | Fully hosted, auto-scales; near-zero cost at demo scale | Req #1 (sustained hosting) + Req #7 |

### Show in video only

| Feature | Notes |
|---|---|
| Critical infrastructure flag on confirmation (PR #181) | Badge appears if school / hospital / utility / government building reported — strong visual moment |
| Zone coverage count on confirmation (PR #181) | "X reports submitted in your area" — collective progress feedback |
| Plus Code on confirmation (PR #181) | Copy-able location code; useful for landmark-free areas |
| Satellite basemap toggle (PR #182) | Visual toggle on dashboard; useful for remote/rural areas — don't dwell |
| Hover tooltips on map clusters (PR #179) | Damage level + date on hover — smooth UX detail |
| Existing reports notification | Before submitting, user sees "2 reports for this building" — prevents redundant effort |

---

## 2-Minute Demo Script

_Target: record on a real Android/iOS device for the community flow; switch to desktop for analyst dashboard._

### Setup before recording
- Active crisis zone covering the demo area (Dan's #77 needed)
- Several seed reports already in the DB so heatmap and coverage map aren't empty
- At least one seed report for a school/hospital/utility so critical infra badge fires
- Device in English for primary cut; have AR or ES cut ready to show multilingual
- Airplane mode ready to toggle for offline segment (optional — cut first if over time)

### Shot list (~2 min)

| Time | Screen | What happens | Why it matters |
|---|---|---|---|
| 0:00–0:15 | Analyst dashboard (desktop) | Create crisis zone, open Community Activation Kit, show QR + WhatsApp template | 48-hour deployment story |
| 0:15–0:25 | Phone — language toggle | Switch to Arabic or Spanish | Scored req #5 — multilingual |
| 0:25–0:40 | Phone — map | Tap a building footprint, not a GPS pin; building highlights | Scored req #6 — building-level ID |
| 0:40–0:55 | Phone — photo + AI | Take/upload photo; AI suggests damage level + infra type with confidence % | AI differentiator moment |
| 0:55–1:10 | Phone — survey + submit | Complete form, hit Submit | Core flow |
| 1:10–1:20 | Phone — confirmation | Critical infra badge fires; zone count shows; tap Share → native share sheet appears | Scored req #3 — engagement incentive |
| 1:20–1:35 | Analyst dashboard (desktop) | New report pins to building on map; heatmap updates; stats bar ticks up | Scored req #2 — "Capture & Display" — make unmissable |
| 1:35–1:50 | Analyst dashboard | Filter by damage level → Export → GeoJSON/CSV downloads | Scored req #2 — "Export" |
| 1:50–2:00 | (Optional) Phone offline | Airplane mode → submit → reconnect → report syncs | Scored req #4 — offline |

**Don't cut:** building footprint tap, AI classification, report pinned to map, export.
**Cut first if over time:** language toggle or offline segment.

### Filming notes
- Use a real phone for the community flow — the native share sheet only appears on mobile and is the demo moment for req #3
- Have the analyst dashboard open on a second device/monitor so the cut is instant
- Keep the AI confidence percentage visible when it pre-selects the damage level — hold for 2 seconds

---

## Proposal Section Drafts

_~500 words each. Bullets are talking points — Paul writes the final prose._

### 1. Problem & Opportunity

- After sudden-onset disasters, responders need structured, geolocated damage data fast — within hours, not days
- Existing methods: paper forms, ad-hoc WhatsApp photos, or expensive specialist survey teams
- Community members are already on-site and motivated; the gap is structured collection at scale with no barriers to entry
- RAPIDA methodology exists but has no lightweight digital tool deployable in 48 hours without an IT team
- Key differentiators: building-level precision (not GPS noise), AI-assisted classification, works offline, viral engagement loop, 6 UN languages

### 2. Solution Overview

- Progressive Web App — no app store, opens from a QR code on any smartphone
- **Community flow (6 steps):** location (tap a VIDA building footprint) → photo → AI-assisted damage classification → survey → submit → confirmation with coverage feedback and share CTA
- **AI classification:** AWS Bedrock (Claude Haiku) — photo → damage level + infrastructure type + confidence score; advisory only, user always confirms or overrides
- **Analyst dashboard:** live severity heatmap (blue→red), Markers/Heatmap/Both toggle, spatial filters by damage level/infra type/crisis type/date range, report detail modal, GeoJSON + CSV export
- **Community Activation Kit:** analyst creates crisis zone with polygon editor → generates QR code + pre-composed WhatsApp message → community is reporting within hours of deployment
- **Engagement loop:** coverage map shows unassessed buildings as gray outlines; post-submit confirmation shows zone progress and critical infrastructure flag; Share CTA recruits neighbours via native share sheet
- **Offline-first architecture:** reports queue to IndexedDB, sync on reconnect with exponential backoff; map tiles cached by service worker for offline navigation
- **6 UN languages:** AR/ZH/EN/FR/RU/ES throughout; English keys in DB, i18next translates at display time
- **Privacy by design:** EXIF stripped server-side; anonymous by default; no account required
- **Infrastructure:** AWS Lambda + API Gateway (auto-scaling), Supabase PostGIS (spatial queries + H3 indexing), S3 (photo storage with EXIF pipeline), CloudFront (CDN + PWA hosting)
- **Scale design:** H3 indexing at R12 (granular) and R8 (aggregation); designed for 500k records per crisis, hundreds of crises per year

### 3. Solution Feasibility

- Live MVP at [URL TBD] — UNDP evaluators can test independently
- Fully hosted on AWS + Supabase; no server management; CloudFront CDN for global availability
- Auto-scaling Lambda handles burst load during acute crisis phases
- H3 spatial indexing supports national-scale datasets (500k+ records) without degraded query performance
- VIDA building footprints available globally (Microsoft + Google combined); manual pin-drop fallback where footprints are absent
- Open-source dependencies (MapLibre, PMTiles, i18next, h3-js) — no licence lock-in, offline-capable
- 9 E2E Playwright tests + CI pipeline; backend, frontend, and integration coverage
- Cost at demo scale: Lambda near-zero (sub-$1/month); Supabase free tier; CloudFront < $1/GB transfer
- _Add: any precedents or references (Ushahidi, KoboToolbox as context; TERRA's differentiators over them)_

### 4. Experience

- _Paul to fill: relevant experience, past projects, domain knowledge_

### 5. Solution Risks

| Risk | Mitigation |
|---|---|
| Building footprints missing in some regions | Manual pin-drop fallback always available; user can proceed without footprint |
| AI classification wrong or overconfident | AI is advisory only — user always confirms or overrides; confidence percentage shown |
| Database load during acute national crisis | H3 indexing + PostGIS designed for 500k records; Lambda auto-scales; load tested in design |
| Community users don't trust the app | Anonymous by default; EXIF stripped; no account; no personal data collected |
| Low smartphone penetration | PWA works on any browser including feature phones; no install required |
| Follow-up question text not auto-translated | Currently English only when analyst types in English — constrain demo to English or add translation layer before submission |
| Dependency on Dan's #77 for live URL | Flag to Dan as submission-critical blocker; evaluators cannot test without it |

### 6. Online References

- RAPIDA methodology: _Add link_
- VIDA building footprints: _Add link_
- _Add: any relevant academic or field references_
- GitHub repo: https://github.com/foad/terra

---

## Known Gaps & How to Frame Them

| Gap | Status | Proposal framing |
|---|---|---|
| Textual/landmark location description (nice-to-have #4) | Not built | Manual pin-drop is the fallback; landmark text input is next-phase |
| Analytics beyond spatial (charts, trends) | Stats bar shows damage counts; no timeline/trend view | Frame stats bar as the analytics entry point; mention extensibility |
| Follow-up question translation | Analyst-typed text not auto-translated | Known limitation; constrain demo to English |
| Live URL | Blocked on Dan #77 | — |
| Export row cap (10k) | Hardcoded | Mention honestly; note it's a current constraint not an architectural one |
