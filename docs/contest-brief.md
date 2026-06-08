# InnoCentive / UNDP Challenge Brief

_Paste the full contest brief here. This is the source of truth for scored requirements._

---

## Scored Requirements

_Paste verbatim from the brief. Current understanding (fill in exact wording):_

| ID | Requirement |
|---|---|
| Req #1 | |
| Req #2 | |
| Req #3 | |
| Req #4 | |
| Req #5 | |
| Req #6 | |
| Req #7 | |

## Nice-to-Haves

| ID | Requirement |
|---|---|
| Nice-to-have #1 | |
| Nice-to-have #2 | |
| Nice-to-have #3 | |
| Nice-to-have #4 | |

---

## Evaluation Criteria / Scoring Rubric

_Paste verbatim._

---

## Full Brief

_Paste the complete original text here._

The United Nations Development Programme (UNDP), the Seeker for this Innocentive Challenge, is seeking innovative, scalable, and user-friendly mechanisms that allow communities to capture and submit damage data in real-time following sudden-onset crises, like earthquakes, floods, hurricanes, wildfires, or conflicts.

These on-the-ground reports will feed the broader assessment and decision-making by crisis response partners, serving as an early signal layer for damage classification, triage, and rapid intervention. Knowing the location and level/grade of damage or service disruption within the first 48 hours of a crisis can significantly improve response effectiveness.

We invite Solvers to build and demonstrate the use of a prototype app (at minimum TRL 4) for communities to upload photos of affected infrastructure, submit short descriptions that categorize the level of damage, and geolocate critical areas using accessible digital methods.

The solution should be highly user-friendly, operate both online and offline, ensure data security and privacy, and utilize open-source methods to allow replication and integration by other agencies. Systems that incorporate analytics on submitted data, AI-informed analysis, or integration with satellite/Geographic Information System (GIS) systems will be preferred.

Solvers must submit:

A written proposal - outline your approach, any tools used, and accessibility information for how a community would use the model;
An interactable prototype or wireframe of the model or tool – must be built to minimum viable product level;
and a demonstrated use case (pitch video or online tutorial not exceeding 2 minutes) of the following functionality:
Capture and Display: inputting a photo, description, and damage classification report, with the output of the photo marked to its accurate building location on a map interface;
Storage: how the information is recorded, anonymised, and retained by the system;
Export: the ability for the data to be exported in a structured format.
This Challenge has a two-phase evaluation structure:

After the Challenge closes, UNDP experts and partners will review your solution, pitch video/tutorial, and technical information, with the aim to select and notify a shortlist of Solvers who will be invited to pitch directly to UNDP.
The pitch will take place for those shortlisted, followed by further analysis and testing of shortlisted solutions, before UNDP finalize any decisions regarding Award and next steps.
In our latest Challenge Space, the UNDP team told us about their top tips! If you're interested in learning more about the Evaluators' requirements for this Challenge, we invite you to watch the webinar recording below.



In the Challenge's attached document, available after you register, you’ll find the answers to the questions raised during the first webinar.



Background


RAPIDA (Rapid Post-Crisis Integrated Digital Assessment) is UNDP’s flagship methodology for early recovery needs assessment. Within 72 hours of a crisis, RAPIDA combines satellite imagery, geospatial overlays, and remote analytics to generate early insights on infrastructure damage, debris, population exposure, and pre-existing vulnerabilities. These insights inform early recovery planning and intervention priorities.

Comprehensive field data collection, including surveys, Key Informant Interviews (KIIs), and on-the-ground assessments, provides a critical, detailed understanding of crisis impacts but typically requires several days to weeks to complete due to operational effort, personnel, and logistical constraints. Rapid community-generated observations can provide an early signal to complement these assessments, enabling faster prioritization and response in areas of greatest need. By capturing firsthand observations quickly, this crowdsourced data can accelerate early recovery workflows, validate preliminary findings, and help crisis response actors reach the most affected communities faster, especially where operational resources or connectivity are limited.

This Challenge seeks digital solutions to introduce an ‘app’ (either online, mobile, or accessed through commonly available digital methods) that allows communities to submit photos, classify damage, and geolocate critical infrastructure to accelerate situational awareness and help guide field assessments.

Initiatives such as UN ASIGN (UNOSAT) successfully demonstrate the feasibility of community-sourced mapping, utilizing what3words location mapping to reference precise locations of flooding, damaged buildings, and electrical line damage without ambiguity. This Challenge aims to develop open-source tools enhanced with AI-informed translation, computer vision, engagement incentives, and other automation features to reduce resource burdens.

The Challenge

UNDP is seeking end-to-end digital solutions (an ‘app’) that can enable community crowdsourcing for damage assessment in the aftermath of sudden-onset crises.

The submitted prototype of your solution should include:

A user-facing frontend, with the ability to:
Accept photos, descriptions, and damage classification submissions via smartphone, WhatsApp, app, website, etc.
Include an interactive map overlay with building footprints
Clear survey structure and submission format
Support all 6 official UN languages (Arabic, Chinese, English, French, Russian, Spanish), either through a toggle, location detection, AI-informed translation, or other method. This includes both the app or solution’s visible/readable language, as well as the support for how users upload descriptions of damage to the solution.
A backend system capable of:
Collecting, validating, storing, and exporting structured data, including a secure database, and analytics regarding collected information.
UNDP’s expectations for the level of usage of this tool include:
For local, sub-national events: up to 50,000 uploaded reports
For medium-scale, regional crises: up to 250,000
For large-scale, national crises: up to 500,000
The database should be structured for scale, with the ability to support hundreds of thousands of records (image, geolocation data, description, metadata) per crisis, and the intention to be used across hundreds of crises per year. Please detail the structure, scale, and architecture of your database in your submission.
A dashboard or map interface, displaying submissions with geolocation and damage classification.
Short video or step-by-step tutorial or guide of no more than 2 minutes, showcasing the way communities use the solution: photo input, damage classification, geolocation mapping, and data export to UNDP.
Solutions should be open-source or built on open-source tools, and must be usable in low-connectivity or low-resource environments. Offline functionality and broad language support are essential for the scalability of your tool to ensure its applicability in the broadest range of contexts.

The app should enable export of structured data using standard interoperable formats (such as CSV, GeoJSON, shapefiles, or REST APIs) so outputs can be integrated into existing UNDP geospatial and data management systems.

Solvers are also asked to demonstrate an interactive user workflow. For example, showcasing the app’s ability to support a user’s ability to upload a photo, select damage level, add a short description, and then seeing that app submission appear geolocated on a map.

Submissions should allow users to classify building damage as:

Minimal/ No damage - structurally sound and functional, showing only cosmetic or no visible damage
Partially damaged – repairable, and remains usable with caution
Completely damaged – structurally unsafe or destroyed
Core indicators of the level of damage that Solvers must build into their methods/systems/approaches include:

Date and time of data collection
Photo of the damaged infrastructure included in the report
Infrastructure damage classification: minimal, partial, completely damaged
GPS coordinates of the damaged infrastructure included in the photo, or building-level insights
It is expected that - over the course of a crisis - building damage may change, and initial reports may become out of date. Your solution should be able to account for the following scenarios:

Multiple damage report submissions about the same building, with different levels of damage
In this case, the system should support ‘versioning’ of damage levels, to show the latest, most up-to-date information about the damage status.
This most likely would be achieved through biasing towards the most recent, complete damage report submission for a particular location.
Multiple damage report submissions in an area, over time
In this case, grouping damage levels and prioritizing required interventions towards a specific location or group of buildings would be of interest.
While the core use case for the app is to augment and improve crisis assessment and response, it is desirable that your app also supports the ability to ask specific, modular questions to specific communities: for instance, to ask about the impact on livelihoods in the months after a crisis. Additionally, your app should have the ability to add modular sections to its damage assessment upload workflow, in order for UNDP to gather other information where necessary. These can be found in the

Appendix 1 document, attachment available on this Challenge.

In order for UNDP to collect relevant information about the nature of the crisis, level of damage, and impacts of the damage, your solution must include the following core multi-select questions that users are required to answer to submit their damage assessment images.

Type of infrastructure:
Residential Infrastructure (Houses and apartments)
Commercial Infrastructure (Markets, malls, shops, hotels, banks, industries, etc.)
Government Building (Administrative buildings, courthouses, police stations, fire stations, etc.)
Utility Infrastructure (Water pumps, power plants, waste treatment plants, etc.)
Transport and Communication Infrastructure (Roads, cell towers, bridges, railway station, bus station, etc.)
Community Infrastructure (Schools, hospitals, community halls, public toilets, etc.)
Public spaces/Recreation Infrastructure (stadiums, playgrounds, religious buildings, etc.)
Other, please specify:
Provide more details on the nature of the infrastructure, including the name of the infrastructure:
Nature of the crisis:
Natural hazards:
Earthquake
Flood
Tsunami
Hurricane/Cyclone
Wildfire
Technological/industrial hazards:
Explosion
Chemical incident
Human-made crises:
Conflict
Civil unrest
Is there any debris that requires clearing on or near the infrastructure site?
Solutions should be designed for sustained use by UNDP and partners.

UNDP is primarily interested in solutions that meet the following must have requirements:

1) The proposal includes a working ‘app’ which enables the crowdsourcing of photos and descriptions of damage in a crisis. UNDP and evaluators will test the minimal viable product (MVP) version of your solution in order to gauge its effectiveness.


Solver solutions must include the following:

A user-facing frontend, with the ability for community members to input photos, descriptions, and damage classifications through one or more of the following methods: digital platform, WhatsApp, app, website, etc.
The frontend must be especially user-friendly, with the 6 UN languages clearly supported (Arabic, Chinese, English, French, Russian, Spanish), and a clear structure and submission format for the upload of damage assessment data.The user-facing frontend should include an interactive map, with overlaid building footprint shapefiles (where available) to give the true picture of the region/geography.
This map should also automatically update when connectivity is available, ensuring that newly-reported damage instances are visible to users and enumerators/evaluator teams in near real-time, and to avoid duplication of reports.
A secure backend system - including code, scalable database, and sustained hosting - capable of collecting, validating, storing, and exporting data, including analytics regarding collected information.
Please note: long-term data storage and costs of any Awarded solution may be handled by UNDP, subject to discussion.

A dashboard or map interface, showing submissions with geolocation and damage classification.

2) Demonstrated user journey or use case, through pitch video or online tutorial of no more than 2 minutes, of the following functionality:

Capture and Display: inputting of a photo, description, and damage classification; and the output of the photo marked to its accurate building location on a map interface.
Storage: displaying how your solution can support hundreds of thousands of records, including data security and privacy;
Export: how the information gathered during a community assessment of a crisis can be structured and export for crisis response analysis.
3) App includes innovative non-monetary features to incentivize engagement, without encouraging repeat submissions or bad actors.

4) Offline functionality: to work in low- or no connectivity settings in the aftermath of crises, or by ‘upload now, send later’ protocols/queue for inputted imagery.

5) Multilingual support: capable of handling and translating local language content via auto-translation or manual configuration of user language. Open source tools for translation are widespread, so creativity is encouraged!

6) Geolocation capture or upload: to enable unambiguous building identification, the application should include building ‘footprints’ where available on its map overlay, for users to select when submitting their damage report. Geolocation data, coordinates, or embedded metadata may not be sufficient for reliable association of an upload to a real-world location, so your solution must utilize a relevant and detailed map and building footprint grid. Additionally, there is preference for the ability to describe the location textually when GPS is unavailable.

7) Secure data handling and hosting: compliance with global data security standards and privacy practices.

Additionally, UNDP are also interested in solutions that display the following nice-to-have characteristics:

1) AI-powered features – for instance, using AI or computer vision to support the app’s classification of damage, area analysis, or other insights

2) Rapid deployment methods: written description of how the solution could be deployed to crisis areas within the first 48 hours after a disaster, including how you would advertise, open source, and support the usage of the tool/solution/system in an affected region

3) Redundancy detection to spot duplicates with the same time-stamp of submission, or over-reporting

4) Ability to describe a location using familiar landmarks in the case of no GPS access – for instance, the school near the central market in City X

Solutions with a minimum Technology Readiness Level (TRL) of 4 are invited.

Please login and register your interest, to complete the submission form.

To be considered for award in this Challenge, Solvers must submit a proposal that includes all elements of a desired solution, including: a written description; working app (frontend, backend, and dashboard/analytics); and video or demo proving the app can complete the required use case of input, upload, and geolocation on a map.

The submitted proposals must be written in English and can include:

Participation type – you will first be asked to inform us how you are participating in this challenge, as a Solver (Individual) or Solver (Organization).
Solution Level - the Technology Readiness Level (TRL) of your solution.
Partnering - there may be an opportunity to partner at the conclusion of this Challenge. Please indicate if partnering is of interest to you.
Problem & Opportunity - highlight the innovation in your approach to the Problem, its point of difference, and the specific advantages/benefits this brings (up to 500 words).
Solution Overview - detail the features of your solution and how they address the SOLUTION REQUIREMENTS, particularly regarding the frontend usage by community members and backend design (including database, code, and data export) (500 words, there is space to add more in the summary field, and attach supporting data, diagrams, etc).
Solution Feasibility – Supporting Information and Rationale, such as references and precedents, that will help UNDP evaluate and validate the feasibility of the solution. Include any details around its cost, and its usability/functionality by non-experts (up to 500 words).
Experience - Expertise, use cases and skills you or your organization have in relation to your proposed solution. (up to 500 words).
Solution Risks - any risks you see with your solution and how you would plan for this (up to 500 words).
Online References - provide links to any publications, articles or press releases of relevance (up to 500 words).
How Did You Hear About This Challenge? - Please identify where you first heard about this challenge.
Attachments - Core attachment requirements include:
Your minimal viable product (MVP) version of your designed ‘app’ for testing and analysis. Please include links to a web version, files that are locally-usable by UNDP evaluators, or other relevant and easy ways for UNDP to independently access your prototype.
A pitch video or tutorial not exceeding 2 minutes, that showcases how your solution achieves the following use case:
Capture & Display of damage assessment information;
Storage of relevant information in a secure, private manner;
and Export (the ability for UNDP and other humanitarian actors to export structured information for crisis response activities).

Submission Close Date: Submissions to this Challenge must be received by 11:59 PM (US Eastern Time) on June 23, 2026.
Late submissions: Late submissions will not be considered.
Multiple submissions, 3 Maximum: In case of multiple submissions by the same Solver, only 3 submissions – the final 3 submitted – will be considered. Any other submissions will be deleted prior to evaluation.
Submission form and attachments: Your submission will be evaluated by the evaluation team first reviewing the information and content you have submitted at the submission form, with attachments used as additional context to your form submission. Submissions relying solely on attachments will receive less attention from the evaluation team.
Evaluation notification steps: After the Challenge submission close date, UNDP will review and select the winning ideas/solutions according to the timeline in the Challenge header. Everyone who submits a proposal will be notified about the status of their submissions.
Use of AI: Please note that any submissions produced solely with generative AI are not of interest.
Learn more: Find out more about participation in Innocentive Challenges
Appendix 1: Modular Form Fields that could be used/of interest to the UNDP

If your solution displays the ability to adjust the form fields used for upload of damage reports to your ‘App’ or Solution, this would be of great interest


In order for UNDP to collect relevant information about the nature of the crisis, level of damage, and impacts of the damage, your solution must include the following core multi-select questions that users are required to answer to submit their damage assessment images.

What is the current condition of electricity infrastructure in your community following the crisis?
o No damage observed

o Minor damage (service disruptions but quickly repairable)

o Moderate damage (partial outages requiring repairs)

o Severe damage (major infrastructure damaged, prolonged outages)

o Completely destroyed (no electricity infrastructure functioning)

o Unknown/cannot be assessed

How would you rate the overall functioning of health services in your community since the event?
o Fully functional

o Partially functional

o Largely disrupted

o Not functioning at all

o Unknown

What are the most pressing needs?
o Food assistance and safe drinking water

o Cash or financial assistance

o Access to healthcare and essential medicines

o Shelter, housing repair, or temporary accommodation

o Restoration of livelihoods or income sources

o Water, sanitation, and hygiene (toilets, washing facilities)

o Restoration of basic services and infrastructure (electricity, roads, schools)

o Protection services and psychosocial support

o Support from local authorities and community organizations

o Other, please specify

Note: The following optional resources are provided for solvers and may support their work on this challenge.

UNDP Personal Data Protection and Privacy Policy: The primary regulatory framework for how we handle personal information.
UNDP Digital Strategy 2022–2025: Outlines how we leverage technology to accelerate the Sustainable Development Goals (SDGs).
UNDP Crisis Bureau – Crisis Response Tools: An overview of how UNDP supports countries in crisis, providing operational context for the critical "72-hour window."
Disclaimer: Innocentive is partnering with UNDP. This is not a UNDP website.

