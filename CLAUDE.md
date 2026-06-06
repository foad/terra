# CLAUDE.md — TERRA Project Context

This file is for Claude Code. Read it at the start of every conversation before doing anything else.

**At the start of every session:**
1. Check the active branch with `git branch` and confirm with Paul. Default working branch is `main`.
2. Fetch current GitHub state so you have accurate, live context — don't rely on stale notes:
   - Open PRs: `GET https://api.github.com/repos/foad/terra/pulls?state=open` (auth via `$env:GITHUB_TOKEN`)
   - Project board priorities/statuses: GraphQL query on project `PVT_kwHOAIZSqs4BUyxf` — fetch items with `Status` and `Priority` field values
   
   Use these as the source of truth for what's in progress, what's awaiting Dan's review, and what to work on next.

**Submission notes, demo tips, known gaps, and proposal angles are tracked in [`SUBMISSION_NOTES.md`](SUBMISSION_NOTES.md).** Update it whenever a ticket surfaces something worth remembering for the demo or proposal.

---

## What TERRA Is

**TERRA** (Tool for Early Reporting and Rapid Assessment) is a PWA for crowdsourced damage assessment after sudden-onset crises. Built for UNDP's RAPIDA methodology. Community members submit geolocated photos + damage classifications; analysts see results on a dashboard and export structured data for crisis response.

**Live repo:** https://github.com/foad/terra
**Tech stack:** React 19 + TypeScript + Vite (PWA), Python Lambda, PostGIS (Supabase), S3, CloudFront, AWS Bedrock (Claude Haiku for AI classification), MapLibre GL + PMTiles, 6 UN languages (EN/ES/FR/AR/RU/ZH)

---

## Why We're Building This

This is a submission for an **InnoCentive / UNDP challenge**. Submission deadline: **June 23, 2026**.

The submission requires:
1. **Working MVP** — UNDP evaluators will independently test it. A live URL is essential.
2. **2-minute demo video** — must show Capture & Display, Storage, Export
3. **Written proposal** — 6 sections (~500 words each): Problem & Opportunity, Solution Overview, Feasibility, Experience, Risks, References

Every code and ticket decision should be made through the lens of: *does this make the demo more compelling or close a scored gap?*

---

## The 2-Minute Demo Plan

**Narrative arc:** Analyst deploys TERRA → Community member submits → Analyst sees live data → Export

| Segment | What it shows |
|---|---|
| Analyst creates crisis zone, generates Community Activation Kit (QR + WhatsApp template) | 48-hour deployment story, modular setup |
| Community member scans QR, switches language, selects building on map | Multilingual, building footprint selection |
| Photo taken → AI suggests damage level → survey completed → confirmation with share CTA | AI moment, core flow, engagement incentive |
| Report appears pinned to building on analyst dashboard, heatmap updates | "Capture & Display" requirement — make this unmissable |
| Analyst filters by damage level → exports GeoJSON/CSV | "Export" requirement |
| (Optional) Airplane mode → submit → reconnect → syncs | Offline differentiator |

**Critical moments to nail:** building pin on map, AI classification visual, export. Don't cut these. Cut language switch first if time is tight.

---

## Team & Division of Work

**Dan (foad)** — built the core architecture. Owns: infrastructure (Terraform/AWS), authentication (#155), demo environment (#77), complex backend/spatial work, anything touching the service worker or sync engine internals.

**Paul** — product and submission strategy. Works with Claude on: self-contained frontend features, simple backend additions, new ticket creation, PR comments, proposal writing, video.

**Rule:** Don't touch Dan's infrastructure or auth work. Flag #77 (demo environment) and #155 (auth) to Dan as urgent — both block the submission.

---

## Working Style

- **Discuss before coding.** On every ticket: read the relevant code, walk through the approach, flag gotchas, get Paul's sign-off, then implement.
- **Comment every PR** with: what was built, why this scope (especially deliberate simplifications), what was deferred and why. See PR #162 as the reference example.
- **Keep scope tight.** Match the challenge brief, not hypothetical future requirements. A scored gap closed is worth more than a polished feature that isn't assessed.
- **Raise tickets** for anything new before building it. Comment on existing tickets when making scope decisions.
- **Paul manages the written proposal and video** — Claude can draft sections on request but Paul owns the narrative voice.

---

## Priority Guidance

**Check the project board at session start** (see instructions above) — it has live Priority (P0/P1/P2) and Status fields. Use that, not any static list here.

Strategic context that won't change:
- **#77 and #155 are Dan's blockers** — don't touch; mention once if directly relevant but don't re-flag every session
- **Proposal sections (#64–#76)** are Paul's domain — he manages these on his own schedule. Do not flag them as blockers or raise deadline urgency at session start.
- **P1 tickets** are scored gaps that directly affect the demo or proposal evaluation
- **P2 tickets** polish the demo or add proposal depth
- Every decision should be framed as: *does this make the demo more compelling or close a scored gap?*

---

## Key Architectural Decisions (don't re-derive these)

- **Offline-first:** All reports queue to IndexedDB first. Sync engine fires on reconnect. Follow-up answers must travel in the initial queue payload — no separate PATCH after the fact.
- **JSONB for modular data:** Follow-up question answers stored as `follow_up_responses JSONB` on the reports table. Crisis-configured questions stored as `follow_up_questions JSONB` on crisis_events. Flexible over fixed columns.
- **Building footprint selection:** Users pick from VIDA footprints on the map. This is a scored requirement — not just GPS pin drop.
- **Version chaining:** Multiple reports for the same building are linked; DB trigger marks older as `is_latest = false`. Always query `WHERE is_latest = true` for current state.
- **H3 indexing:** Reports indexed at R12 (granular) and R8 (aggregation). Use these for spatial queries, not raw bounding box where possible.
- **Privacy by design:** EXIF stripped server-side on photo upload. Anonymous by default — no account required.
- **Language in DB:** English keys stored (e.g. "residential"), i18next translates at display time. Never store translated strings in the DB.

---

## What's Already Built (don't re-implement)

- Full 6-step report submission flow (location → photo → damage → survey → confirmation)
- AI classification via AWS Bedrock (Claude Haiku) — damage level + infrastructure type + confidence
- Offline sync engine with IndexedDB queue and exponential backoff
- PMTiles offline tile caching with custom service worker handler for HTTP 206
- PostGIS spatial queries with H3 indexing
- Version chaining (multiple reports per building)
- Duplicate/reassessment detection — PR #162 (same building_id = reassessment, same location <15m <2min = duplicate)
- CSV + GeoJSON export (10k row cap)
- 6 UN languages
- Admin crisis event CRUD with polygon region editor
- Analyst dashboard with spatial filters and report detail modal
- Dashboard heatmap layer (severity-weighted, blue→red), summary stats bar, map legend, and Markers/Heatmap/Both toggle — PR #179
- Photo privacy pipeline (EXIF extract → thumbnail → strip)
- 9 E2E Playwright tests

---

## DB Migration Numbering

Latest migration: `009_add_follow_up_questions.sql`. Next migration should be `010_`.

**Important:** PR #165 (follow-up questions) requires migration 009 to be run against Supabase before it goes live — the backend will error on crisis saves without it. Flag this to Dan.

---

## Ticket Conventions

- Labels follow Dan's pattern: `frontend`, `backend`, `dashboard`, `ai`, `infra`, `offline`, `data`, `enhancement`, `proposal`, `video`
- Always comment on both the issue AND the PR when making scope decisions
- Reference the challenge brief quote when justifying a scoping decision (see issue #54 comment as example)
- GitHub token is in the `GITHUB_TOKEN` environment variable — never paste tokens in chat
