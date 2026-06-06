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

### Segment: Community Activation Kit (#163)
- Analyst hits the QR code icon on any crisis row in `/admin/crises`.
- Modal opens with: large QR code, shareable URL + copy, WhatsApp/SMS template in all 6 UN languages (language tabs, copy button each), and a **Print deployment poster** button.
- "Print deployment poster" opens a new window with a clean A4 poster — TERRA name, crisis name/type, QR code, multilingual scan instruction, URL — and auto-triggers the browser print dialog.
- **Demo angle:** Open the modal, switch between a couple of language tabs, click Print. The poster appearing is the "48-hour deployment" visual — one button and the analyst has everything to hand to a community leader.
- **Poster design is MVP-quality** — clean and functional, suitable for UNDP context, but not marketing-polished. Follow-on design work tracked in [#167](https://github.com/foad/terra/issues/167).

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
- **[#168 — not yet built]** Face detection auto-blurs any faces in the photo before storage. If built, add a beat here: "faces are automatically protected."

### Segment: Analyst reviews and corrects AI output
- **[#169 — not yet built]** Analyst can override the AI damage classification directly from the report detail modal. Demo moment: show analyst correcting an AI assessment — reinforces human-in-the-loop story.

### Segment: Infrastructure damage
- **[#171 — not yet built]** Non-building report type (road, bridge, landslide) using a point-drop instead of VIDA footprint. If built, show a "blocked road" report alongside a building report to demonstrate TERRA covers the full crisis damage picture.

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

## Proposal Angles Worth Noting

- **Non-monetary engagement incentive:** The share CTA (#164) is the direct answer to this scored criterion. Frame it as a viral loop: each submitter can recruit neighbours, multiplying data density without any incentive spend.
- **48-hour deployment story:** Crisis zone creation + Community Activation Kit (#163) — analyst creates a crisis, hits one button, gets QR code + WhatsApp template in all 6 UN languages + printable A4 poster. Community is reporting within hours.
- **Privacy by design:** EXIF stripped server-side, anonymous by default, no account required. Strong point for a UNDP audience. **[#168 — not yet built]** Face detection + auto-blurring closes the remaining gap — faces in photos are automatically protected before storage.
- **Offline-first:** Reports queue to IndexedDB, sync on reconnect. Differentiator for low-connectivity crisis environments.
- **Human-in-the-loop AI:** **[#169 — not yet built]** Analyst reclassification shows TERRA is a tool for analysts, not a black box. Addresses "what if the AI gets it wrong?" in Feasibility/Experience sections.
- **Data governance:** **[#170 — not yet built]** Report flagging gives analysts a tool to exclude suspect or abusive submissions from exports. Addresses aid-gaming risk in the Risks section.
- **Beyond buildings:** **[#171 — not yet built]** Infrastructure damage reports (roads, bridges, landslides) broaden RAPIDA applicability. Answer to "what about roads?" in Solution Overview — shows TERRA covers the full crisis damage picture.

---

## PRs Awaiting Dan

| PR | Ticket | What Dan needs to do |
|---|---|---|
| [#162](https://github.com/foad/terra/pull/162) | #54 Duplicate detection | Review + merge |
| [#165](https://github.com/foad/terra/pull/165) | #161 Follow-up questions | Review + merge + run `db/009_add_follow_up_questions.sql` against Supabase |
| _#166 (not yet opened)_ | #164 Share CTA | Review + merge (no migration needed) |
| _not yet opened_ | #163 Community Activation Kit | Review + merge (no migration needed) |
