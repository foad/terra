# TERRA Submission Notes

Working document for demo prep, proposal writing, and anything worth remembering across tickets.
Deadline: **23 June 2026**

---

## Links

| What | URL |
|---|---|
| GitHub repo | https://github.com/foad/terra |
| Live app (community submission) | _TBD — pending Dan's #77_ |
| Analyst dashboard | _TBD — pending Dan's #77_ |
| InnoCentive challenge page | _Add URL here_ |

---

## Demo Script Notes

### Segment: Confirmation screen share CTA (#164)
- On **mobile** (Android/iOS), the "Share with neighbours" button triggers the native OS share sheet — WhatsApp, SMS, etc. appear automatically. This is the visual you want in the video.
- On **desktop** it falls back to two static buttons (Copy link + Share via WhatsApp). Record the demo on a real phone if possible.
- The pre-composed WhatsApp message includes the crisis name when available (pulled from the active crisis at the user's location).
- The share CTA appears in **both** online and offline states — the link still works even if the report is queued.

### Segment: Building footprint selection
- Users pick from VIDA building footprints on the map — not just a GPS pin drop. This is a scored requirement; make it unmissable in the demo.

### Segment: AI damage classification
- After photo upload, Claude Haiku suggests a damage level + infrastructure type + confidence score.
- The AI suggestion pre-selects the damage level; the user can override it. The confidence score is shown.
- This is a "wow moment" — hold on it in the video.

### Segment: Export
- Analyst filters by damage level → exports GeoJSON or CSV.
- The export is capped at 10k rows. Fine for demo; worth noting in the proposal as a current constraint.

---

## Known Gaps / Things to Fix Before Submission

### Follow-up questions not translated (#161 / PR #165)
- Analyst-configured follow-up question **text** is stored in the DB as entered (English assumed).
- These questions are rendered directly without going through i18next.
- If the demo is run in a non-English language, the follow-up questions will appear in whatever language the analyst typed them.
- **Decision needed:** either constrain the demo to English, or add a translation layer before submission.

---

## Engagement Incentivization — The Coverage Loop

Three features being built as a connected system (must-have criterion #3):

### PR A — Confirmation screen enhancements (#48 + #180, bundle together)
- **Zone coverage % + milestone (#48):** Confirmation shows "Zone 3 is now 67% assessed." When zone tips past threshold: "Zone fully assessed — added to UNDP priority review." Every submission gets a feedback moment tied to collective progress.
- **Critical infrastructure flag (#180):** If the reported building is a school, hospital, utility, or community infrastructure (from AI classification), confirmation shows a distinct callout: "You've flagged a critical infrastructure point — prioritized for UNDP review." Strong demo moment — reporter sees it flagged, analyst sees the priority pin appear on the dashboard.

### PR B — Community coverage map layer (#47, own PR)
- Reported buildings visible on the community PWA map, colour-coded by damage severity (green/amber/red)
- Unassessed VIDA footprints as faint outlines — the map itself becomes the incentive
- Fixes the "app feels lifeless" problem; seeing gray outlines nearby directs reporters to unassessed buildings
- Anti-gaming: the map directs to gaps, not repeat submissions

### Later — Analyst zone flagging (#46)
- Analyst flags a priority zone → appears as highlighted area in the community coverage map
- Makes the loop bidirectional: analyst dispatch → community response

### Demo sequence these enable
Community submits → confirmation shows zone % + critical infra flag → cut to analyst dashboard → report appears as priority pin → heatmap zone ticks toward completion. A 20-second arc that's hard to forget.

---

## Proposal Angles Worth Noting

- **Non-monetary engagement incentive:** The coverage loop (share CTA + coverage map + zone milestone + critical infra flag) is the answer to scored criterion #3. Frame as: every submission has visible community impact — reporters see coverage grow, zones complete, and critical buildings get flagged. Not gamification — direct feedback that their report matters.
- **48-hour deployment story:** Crisis zone creation + Community Activation Kit (#163, PR #172) is the hook. Analyst creates a crisis, generates a QR code and WhatsApp template, distributes it — community is reporting within hours.
- **Privacy by design:** EXIF stripped server-side, anonymous by default, no account required. Strong point for a UNDP audience.
- **Offline-first:** Reports queue to IndexedDB, sync on reconnect. Differentiator for low-connectivity crisis environments.

---

## PRs Awaiting Dan

| PR | Ticket | What Dan needs to do |
|---|---|---|
| [#162](https://github.com/foad/terra/pull/162) | #54 Duplicate detection | Review + merge |
| [#165](https://github.com/foad/terra/pull/165) | #161 Follow-up questions | Review + merge + run `db/009_add_follow_up_questions.sql` against Supabase |
| _#166 (not yet opened)_ | #164 Share CTA | Review + merge (no migration needed) |
