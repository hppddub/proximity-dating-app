# Proximity dating: research and open decisions

Research date: October 25, 2026 (America/Toronto). Status: **research report with verified primary sources and explicitly identified follow-up gaps**. This is a research document, not an implementation plan or a selected system architecture.

## 1. What we are investigating

The intended experience is: create a profile, opt into discovery, put the phone away, and receive an introduction opportunity when a mutually eligible, potentially compatible person is nearby. There is no swipe feed or manual selection of potential matches.

Confirmed requirements:

- Adults 18+ only; both people's eligibility preferences must be satisfied.
- Begin in Waterloo and Toronto, potentially expand across Canada and eventually the US.
- Choose the initial mobile platform based on feasibility rather than an existing preference.
- Offer pause/peace and background-discovery modes. Users should eventually choose scopes such as public venues, selected places, broader settings, or a time limit such as today. Notification intensity is a separate open choice.
- Keep profiles hidden until an intentional in-person connection, potentially signaled by bringing phones together. Encourage real conversation and minimize phone interaction.
- Limit early testing to public settings.
- Minimize location collection. The objective is recognizing proximity, not collecting movement histories.
- Use Git, Node.js, and npm where applicable; follow normal engineering practices. Application implementation and system design are deferred to a later discussion.

The user clarified identity reveal and public testing during research. Recognition remains undecided. The user asked to compare a face preview, shared symbol, shared keyword, and proximity-driven haptics. A face preview would be an explicit exception to pre-connection identity hiding, not permission to expose the full profile.

## 2. Main findings

1. **Proximity detection and geographic location tracking are different capabilities.** Bluetooth Low Energy (BLE) can provide evidence that two devices are near each other without needing either device's latitude/longitude. Canada's retired COVID Alert app is a concrete, documented example of this distinction. [S1–S4]
2. **No GPS does not mean no tracking risk.** A backend that resolves encounter tokens to accounts can accumulate a social encounter graph. Repeated timestamps, IP logs, known venues, analytics, and profile disclosure can reveal sensitive routines. Rotating identifiers reduce some risks; they do not guarantee anonymity. [S2, S4]
3. **The hardest unproven promise is timely discovery while phones are locked.** Official Android sample code uses filtered scans and a PendingIntent and explicitly discusses screen-off batching and reduced background scan power. This establishes relevant mechanisms, not reliable coffee-line alerts. Apple documents slower background scans and restrictions on background advertisements, including an iOS-specific service-discovery path. Cross-platform behavior and timing still require physical-device experiments. [S5, S6, S11, S12]
4. **Exact simultaneous notifications should not be promised.** Radio discovery, device scheduling, connectivity, notification permissions, and user attention are independent on the two phones. A coordinated introduction can be a product goal; delivery at the same instant is not a defensible guarantee.
5. **Automatic matching does not establish romantic compatibility.** Mutual eligibility can be checked objectively. Whether eligible people feel attraction or want to meet is an empirical question. Start research with interpretable criteria and user outcomes rather than assume a sophisticated algorithm will solve it.
6. **There is substantial adjacent prior art.** Crossed-path dating, nearby-person discovery, curated introductions, and getting people off the app are established product categories. The exact combination in this vision may still differ, but this research does not establish novelty or a complete competitor census.

## 3. Similar products and historical precedents

### Verified product comparisons

**happn is the closest verified conceptual competitor.** Its homepage says “Cross paths, Date local.” Its trust charter describes “hyperlocation in real time,” approximate crossed-path locations, mutual opt-in, and blocking. That confirms substantial overlap with proximity-based dating; it does not establish automatic compatibility alerts while both people stand together. The charter contains apparently legacy material, including mandatory Facebook connection, so it should not be treated as a fully current feature specification. Its linked privacy policy remained inaccessible. No conclusion about current location retention is justified from the homepage or charter alone. [S9]

**Breeze is a verified comparison for minimizing screen-based courtship.** Its site describes daily profile suggestions, skipping chat after matching, and arranged dates at partner venues. Its FAQ explicitly discusses likes, reciprocal matches, and profile/preference/behavior-based recommendations. It therefore differs from this vision's no-manual-selection and spontaneous nearby encounter. The FAQ lists multiple European countries and the US; Canada is not among the countries listed, which does not prove no Canadian availability. Its safety and success claims are vendor claims, not independently verified outcomes. [S10]

Neither source establishes that the complete proposed combination is unique. Product research should compare behavior rather than slogans or proprietary algorithm claims.

### Other dating/social products and historical precedents to investigate

These are background-knowledge leads, **not verified descriptions of October 2026 features or Canadian availability**:

| Product / project | Relevant historical association | What still needs checking |
| --- | --- | --- |
| Grindr / Badoo | Nearby-person browsing | Current distance disclosure, discovery controls, privacy, and distinction from automatic introductions. |
| Thursday | Time-constrained dating and in-person events | Current app/event model, local availability, and concentration of participants. Its tested website was blocked. |
| Coffee Meets Bagel / Once | Curated or limited daily recommendations | Human selection and mutual opt-in versus automatic matching. Curation does not establish prediction of chemistry. |
| MeetMoi; Highlight; Sonar | Location-aware dating or ambient social discovery | Original dated reporting, exact alert behavior, lifecycle, and any evidence explaining adoption or failure. |
| MIT Serendipity | Bluetooth-assisted social introduction research | Crossref verifies Eagle and Pentland's 2005 paper, **“Social Serendipity: Mobilizing Social Software,” DOI 10.1109/MPRV.2005.37**. The original project page/full text were not retrieved, so exact implementation claims remain unverified. [S17] |

The useful distinction to test is **passive, mutually eligible, context-appropriate introductions without a feed or retained movement history**. This is a positioning hypothesis, not a claim that nobody has tried it.

For every serious comparison, follow up on status/date, market, detection mechanism, foreground/background behavior, retention, control, notification timing, monetization, local density, and independent evidence of outcomes. This is a non-exhaustive comparison, not a patent or freedom-to-operate search.

### Verified technical precedents

**Canada's COVID Alert:** The official repository describes a React Native client for Apple/Google Exposure Notification and states that the app is now retired. The government privacy assessment explains short-range Bluetooth random identifiers, consent, local encounter matching, and the absence of a centralized record of which two devices met. It also discusses linkage attacks, limited-contact identity inference, IP addresses, metrics, and retention. [S1, S2]

**DP-3T:** The research consortium documents decentralized privacy-preserving proximity tracing and publishes its design and analyses. It demonstrates that proximity can be the data primitive rather than geographic coordinates. Its public-health goals and delayed exposure workflow differ substantially from real-time dating introductions. [S3]

**Google Exposure Notification internals:** Google's published snapshot explains coordination of Bluetooth MAC-address changes and rotating proximity identifiers. This is valuable evidence that rotating application tokens alone is an incomplete privacy story. The repository explicitly says the snapshot is not planned to be updated. [S4]

**Important qualification:** These historical exposure systems used special operating-system integration. The Canadian assessment describes a protected OS layer and restricted application access. They are evidence for privacy concepts, not an available dating API or proof that an ordinary app can reproduce their background performance. [S2] Even the DP-3T iOS SDK documentation references exposure-notification-specific integration. [S8]

## 4. What “only enough location” can mean

There are three separate decisions: what sensors the phone uses, what data leaves the phone, and what anyone retains. These should be stated separately in any eventual privacy promise.

| Approach | What it can establish | Privacy and practical tradeoffs | Assessment for this vision |
| --- | --- | --- | --- |
| Frequent GPS/server location updates | Approximate geographic position and distance between coordinates | Strong movement-data exposure; indoor accuracy and background limits still matter. | Poor default fit for the stated privacy goal. |
| Coarse geographic areas / geofences | Same neighborhood or broad venue area | Lower precision still reveals presence; not proof of standing together. Sparse areas can make coarse data identifying. | Possible candidate filtering only; not enough for the coffee-line promise. |
| Phone-to-phone BLE | Devices exchanged or detected nearby radio signals | Can avoid GPS; signal is affected by bodies, walls, pockets, phone models, scan schedules, and background execution. Encounter tokens remain sensitive when linkable. | Strongest research candidate for coordinate-free proximity; reliability unproven here. |
| Coarse location plus BLE confirmation | Broad candidate discovery plus local radio evidence | May trade efficiency for an additional location-data surface. Needs a reason to collect both. | Compare only if BLE-only constraints justify it; not an architecture decision. |
| Explicit venue check-in / QR / event session | People consented to presence in a venue/session | Requires user action; venue membership does not prove physical closeness. Can create a sensitive attendance log. | Useful pilot alternative if acceptable to the user. |
| UWB / precise ranging | Precise ranging on supported devices under supported conditions | Hardware and platform constraints; not universal passive discovery. | Later research option, not a universal substitute for BLE. |
| Nearby Connections | Discovery and data exchange over supported local radios | Google's source describes Bluetooth/Wi-Fi connections, not romantic matching or a guaranteed background wakeup. The source repository carries a support disclaimer; the separately documented Nearby Connections SDK supports Android and iOS. | Official SDK documentation describes bilateral connection acceptance and encrypted exchange, not guaranteed passive background discovery. [S7, S18] |

“Same coffee shop,” “within radio range,” and “standing beside each other” are different claims. A wall may separate people whose phones hear one another. A phone in a bag may miss someone close by. A dwell-time requirement could reduce transient matches but miss brief sidewalk crossings. These are product tradeoffs to measure later, not problems a distance threshold alone settles.

### Privacy properties worth evaluating

These are proposed research criteria, not a selected design:

- No raw GPS history for the ordinary introduction flow unless a demonstrated need changes that decision.
- No public distance display, map pin, encounter history, or list of nearby accounts by default.
- No stable account ID, name, orientation, profile text, or matching preferences in radio advertisements.
- Short-lived opaque identifiers, with explicit analysis of cross-layer correlation and server linkage.
- Minimal encounter retention and a deletion rationale for every retained field; debug logs and backups count.
- Distinguish local detection, server-side eligibility/matching, and identity reveal. Each leaks different information.
- Inspect analytics and crash-reporting SDKs, advertising identifiers, push payloads, notification previews, IP logs, and third-party processors.
- Explicitly document what the operator can reconstruct. “Encrypted” is not the same as “the service cannot link encounters.”
- Avoid claims of being anonymous or untrackable. Even a vague alert in a room with two people may reveal who the other user is.

Private set intersection and other cryptographic protocols are possible further research topics, but should not be assumed to solve profile matching, abuse prevention, timing leakage, and mobile background constraints together. A local compatibility check also needs careful analysis: handing a stranger enough profile attributes to score compatibility may reveal precisely the sensitive information we intended to protect.

## 5. Mobile feasibility and the initial platform

| Question | Android | iPhone |
| --- | --- | --- |
| Relevant evidence obtained | Official BLE sample provides filtered PendingIntent scanning; historical AOSP code documents screen-off restrictions. [S5, S6] | Apple documents background central/peripheral modes, slower scans, and advertisement restrictions. Historical exposure SDK privileges are separate. [S8, S11] |
| Main research concern | Background limits, power management across vendors, permission differences, foreground-service and store requirements. Current BLE background guidance checked; vendor-specific behavior still untested. [S12] | Background scanning/advertising behavior, suspension, advertising data restrictions, and cross-platform discovery. Apple background guide checked; it is archived and needs current-device validation. [S11] |
| Research practicality | Linux can support much of Android tooling; physical devices still required. | A normal native iOS build/signing workflow requires Apple tooling on macOS; physical devices still required. |
| Tentative view | Likely the easier controlled feasibility experiment if suitable Android phones are available. | Could be the better pilot audience, but we do not yet have evidence to recommend it for passive discovery. |

Do not select Android solely because it is easier to build locally. A single-platform pilot excludes encounters with users of the other platform. Later audience research in Waterloo/Toronto should establish actual device distribution and access to testers.

Apple's archived Core Bluetooth guide explicitly documents coalesced background discoveries, longer scan intervals when all scanning apps are backgrounded, no advertised local name in the background, and service UUIDs in an overflow area discoverable only by iOS devices explicitly scanning for them. It also warns that apps cannot run indefinitely and that advertising frequency may decrease. **This is a specific warning against assuming symmetric iPhone–Android background discovery, not proof that every possible cross-platform approach is impossible.** Current-device validation and a fuller current-API review remain necessary. [S11]

Android's current background guide recommends filtered PendingIntent scans when discovery should wake a process, discourages periodic scans, and explains background service/activity launch restrictions. Companion-device mechanisms are not automatically suitable for encounters with arbitrary strangers. Its background-location guide says background location updates may occur only a few times per hour on affected Android versions, reinforcing that frequent GPS is not a simple route to immediate alerts. [S12]

Node.js/npm are compatible with a JavaScript backend and potentially a shared mobile application layer. They do not replace Bluetooth APIs, native permissions, signing, or OS lifecycle work. No mobile framework is selected here.

A later feasibility study should measure discovery and alert latency, successful encounters, false proximity detections, battery use, and stale alerts across foreground/background, locked screens, low-power mode, force-quit/force-stop, permission changes, reboot, unreliable connectivity, and multiple devices nearby. Pairings should include Android–Android, iPhone–iPhone, and Android–iPhone before claiming cross-platform behavior. This is an evidence requirement, not a build plan.

## 6. Automatic matching without swiping

### Separate eligibility, compatibility, and current availability

**Eligibility is bilateral and hard:** each person's age range, gender/orientation-related preferences, relationship intent, blocks, account status, and adult eligibility must allow the pairing. Never infer orientation from behavior or disclose somebody's sensitive preference to explain a rejection.

**Compatibility is uncertain and soft:** shared interests, values, lifestyle, conversation preferences, and relationship goals can provide interpretable signals. Agreement on everything is not a demonstrated measure of chemistry. Self-reported profiles can be incomplete, strategic, or stale.

**Availability is contextual:** two otherwise compatible people should not trigger an introduction if either has paused discovery, declined further alerts, is in an unsuitable context, or has recently dismissed that pairing. Consent to background discovery is not consent to every interaction.

A sensible research baseline is a transparent rule/weighted-score approach with minimum bilateral eligibility, compared against simpler eligible-person baselines. Any weights, scoring scale, thresholds, cooldowns, or per-day limits would be hypotheses to test. A score such as “92% compatible” would imply calibration we do not have.

A later reciprocal model would need evidence about both A's interest in B and B's interest in A. Optimizing average predicted interest can still pair one very interested person with an uninterested person; a mutual objective and abstention matter. Stable matching can allocate known preferences, but does not discover true preferences or guarantee romantic success, especially with brief, changing encounter windows.

### What research has and has not established

Two relevant literature leads are Finkel et al., **“Online Dating: A Critical Analysis From the Perspective of Psychological Science”** (2012; DOI `10.1177/1529100612436522`) and Joel, Eastwick, and Finkel, **“Is Romantic Desire Predictable? Machine Learning Applied to Initial Romantic Attraction”** (2017; DOI `10.1177/0956797617714580`). Crossref metadata verified both publications; the publisher full-text requests were denied. The 2017 abstract was available through Crossref: in two speed-dating studies, random-forest models could predict some overall tendencies to desire or be desired, but did not predict pair-specific desire beyond those tendencies from the pre-date self-reports. This supports caution about promising chemistry from profiles; it does **not** prove all matching algorithms are useless. The studies' speed-dating/opposite-sex setting and limited design should not be generalized to all orientations, relationship goals, or later outcomes. No full-text methodological appraisal was performed. The 2012 paper remains a literature-review lead, with metadata checked but its arguments not appraised. [S15]

Early evaluation should distinguish delivery success, perceived appropriateness, mutual willingness to meet, safe interactions, unwanted approaches, repeat alerts, and later satisfaction. Clicks, hours in the app, and notification opens are inadequate objectives for a product intended to stay out of the way. A nonresponse can mean the person was busy or the alert never arrived; it is not clean evidence of rejection.

Learning-based ranking has a cold-start problem and can reinforce popularity biases and exclusion. Sensitive preferences, sample imbalance, fairness, manipulation by fake profiles, and data minimization need explicit examination before adopting embeddings or machine learning. An LLM should not be assumed to infer personality or romantic compatibility reliably from a short biography.

## 7. Notification and interaction options

The user wants profiles hidden until the pair intentionally connects in person. The app selects the match automatically; any confirmation should establish consent and the correct nearby pair, rather than become a swipe-like selection flow. The exact gesture and number of phone interactions remain undecided.

| Option | Experience | Benefits | Risks / constraints | Research judgment |
| --- | --- | --- | --- | --- |
| Quiet notification | “A possible connection is nearby.” | Low pressure; avoids a profile on a locked screen. | Easy to miss; can still identify someone in a small space; may cause searching or confusion. | Worth evaluating. |
| Standard opt-in haptic/sound | One bounded alert subject to phone settings. | More noticeable during an active discovery mode. | Can interrupt work or reveal dating-app use. | Worth evaluating with caps and dismissal. |
| Mutual introduction invitation | Each may accept; reveal follows agreed consent rules. | Clear control without swiping. | Adds a step; either may miss the window; acceptance itself leaks information depending on presentation. | Strong candidate for research, not a settled flow. |
| Identity/profile shown immediately | Matched person's profile appears with the alert. | Makes the introduction concrete. | Unwanted recognition, outing, stalking, and awkward approaches; stranger may act before the other person sees the alert. | Outside the clarified vision; retain only as a comparison. |
| Optional bounded reminder | One reminder while the opportunity remains fresh. | Helps someone who missed the first alert. | Duplicate alerts and pressure; stale proximity. | Possible user-controlled setting; expiry and caps required. |
| Full-screen / alarm-like experience | Intrusive interruption. | High salience. | Consumer OS restrictions; inappropriate urgency; distress and public exposure. | Poor default fit; relevant platform restrictions are summarized below. |
| Lock the phone / buzz indefinitely until meeting or exchanging numbers | Forces an action before relief. | No necessary benefit for a voluntary introduction. | Ordinary consumer apps cannot assume device-control privileges; coercive, unsafe to dismiss, and no trustworthy way to prove a consensual meeting or number exchange. | Reject as a product direction. |

Neither platform should be assumed to let a dating app bypass Focus/Do Not Disturb, silent settings, notification refusal, or user dismissal. Special alarm, critical-alert, device-administration, or accessibility capabilities are not a general route to force a dating interaction. Google Play's full-screen-intent guidance says automatic grants are for core alarm/calling use cases; other uses need user-granted permission and remain subject to policy. That is not a path to make a dating encounter mandatory. Apple's review guidelines restrict background services to intended purposes and prohibit sensitive personal information in push notifications. Guideline 4.3(b) also explicitly identifies dating as a saturated category needing a meaningfully different or improved experience. These are relevant review constraints, not a prediction of app approval. [S16]

Do not combine discovery consent and alert intensity into one ambiguous slider. Someone may want background discovery with quiet alerts, or an active session with a noticeable alert. Independently understandable controls are a better hypothesis: visibility/discovery state, alert intensity, and identity-reveal preferences. A peace setting should stop new participation in introductions, not merely silence one person's phone while the other person is still encouraged to approach them.

Simultaneous delivery should be described as a best-effort coordinated opportunity. Stale alerts should expire. Neither person should be told the other is definitely still present, interested, or aware of the introduction merely because an alert was sent.

### In-person connection before profile reveal

Apple's NameDrop guide describes holding devices close, an interface appearing on both, choosing share/receive behavior, selecting contact fields, and cancelling by moving apart or locking the phone. That is a strong **interaction reference**, not a verified reusable dating-app API. Current Core NFC documentation describes tag reading/writing and protocol-specific tag interactions; it does not establish a general cross-platform phone-to-phone dating-profile exchange. Do not assume an arbitrary app can invoke NameDrop or make that experience work between iPhone and Android. [S13]

| Candidate interaction | Screen effort | What needs investigation |
| --- | --- | --- |
| Bring phones close, then each confirms | Potentially brief and natural | Which supported radio/API establishes the intended pair on each OS, whether both apps must be open, explicit mutual consent, and behavior with several phones close by. Physical closeness alone does not authenticate the matched account. |
| Show a short-lived QR code; the other scans; both confirm as needed | A brief app interaction | Cross-platform practicality, camera permission, accessibility, screenshots/replay, expiry, and avoiding accidental profile reveal to a different person. |
| Compare or enter a short-lived shared code | More manual effort | Pair binding, guessing/rate limits, expiry, and whether the friction undermines the desired natural interaction. |
| Shared temporary symbol/color followed by intentional connection | A quick glance | Helps recognition without displaying profiles, but is not an authentication mechanism. Consider color-blindness, copying, collisions, and how conspicuous it feels. |
| Speech or an agreed visible gesture with no app confirmation | Minimal phone interaction | How to bind the right accounts safely. Hearing a phrase or seeing a gesture is not reliable proof of the intended account pair. |

The user's additional recognition options deserve separate comparison:

- **Face preview:** probably more direct recognition, but reveals identity before connection. Requires an explicit product decision to make an exception to hidden identity; risks include screenshots, misidentification, and approaching someone before they see the alert.
- **Shared symbol/color:** brief, relatively private, and potentially low effort, but needs an app glance or visible gesture. Copying/collisions and accessibility must be considered; it is not authentication.
- **Shared “spy” keyword:** playful, and can move the interaction into speech. It can also create awkward approaches to non-users, be overheard, or be repeated by a bystander; it should not unlock profiles by itself.
- **Hotter/colder buzzing:** may reduce looking at a screen, but Bluetooth signal strength does not provide dependable distance or direction in a cafe. Signal changes with bodies, walls, pockets, and movement. Repeated proximity feedback may help a person triangulate or follow someone. Even optional use needs bilateral consent, bounded duration, and careful testing; it should not be the sole identity or safety signal.

These remain options, not selected features. None was built or device-tested. The successful product interaction may still involve a short phone action **after** the conversation starts. There is no reliable technical signal that proves a voluntary conversation happened, and a connection gesture should not require exchanging phone numbers.

A critical UX tension remains: two anonymous alerts do not tell users whom to approach in a crowded café. A generic “look around” alert may create confusion or approaches to non-users. Conversely, any recognition signal reduces anonymity. Research should test comfort and identification error, not assume the tension disappears because profiles are hidden.

### User-selected places and times

The clarified scope choices should be evaluated independently of notification intensity. “Public places only” needs a definition: a cafe open to the public, a ticketed event, campus space, and a workplace common area are different contexts. Bluetooth alone cannot classify a place as public. Geographic place filters could require location/map data; explicit venue sessions or user-selected activation avoid some inference but add effort. This is a direct tradeoff with the low-data and low-screen-use goals.

Likewise, suppressing discovery at home using a saved geographic exclusion introduces sensitive place information. It should not be silently added as a privacy feature. Research needs to compare local-only exclusions, explicit pause, and other supported approaches. “Only today” should have a clear local expiry and confirmation of the resulting paused state. Public testing does not imply all future discovery must be event-based or manually checked in.

## 8. Safety, privacy, and Ontario/Canada research

This product exposes presence and dating eligibility together. Relevant abuse cases include repeated approaches, ex-partner tracking, fake accounts, relay/replay of radio signals, notification spam, location triangulation, account enumeration, outing, and harassment after a declined introduction.

Research requirements include blocking that suppresses future pairings, reporting, rate limits and repeat-pair cooldowns, discreet notification previews, expiry, account abuse controls, and practical moderation response. A block may take time to propagate if a device is offline; later design must define safe behavior rather than promise instantaneous global enforcement.

18+ eligibility needs more than writing “adults only.” Investigate proportional age assurance, underage reports, appeals, and avoiding unnecessary retention of identity documents. Likewise, anti-fraud measures must be weighed against their own privacy costs.

For an Ontario commercial dating service, **PIPEDA is a central legal research topic**, alongside meaningful consent, sensitive personal information, safeguards, retention, access/deletion handling, breach responsibilities, and cross-border processors. Verify applicability and current law with Canadian primary sources before launch; do not assume a public-health privacy assessment's legal conclusions apply to a private dating business. US expansion and expansion into other provinces need separate review. The OPC's meaningful-consent guidance was retrieved: it emphasizes understandable purposes, third-party disclosures, meaningful residual risks, choices for nonessential processing, withdrawal, and generally express consent for sensitive or unexpected handling. An OS permission dialog does not replace that explanation. This is verified guidance, not a completed legal applicability review. [S14]

Peace/pause, discreet identity handling, and the absence of a public nearby-user map are substantive product decisions. They should be assessed with prospective users, including people for whom revealing orientation or presence can have serious consequences. The appropriate balance cannot be inferred from engineering convenience.

## 9. Waterloo/Toronto: why local density matters

Total registered users are a weak proxy for encounter opportunities. The relevant population is eligible adults in the same place and time who opted into discovery and whose devices can actually detect and notify one another.

For intuition only: if a person encounters 20 app users, 25% are mutually eligible, and 40% have discovery active, the expected eligible active encounters are `20 × 0.25 × 0.40 = 2` before compatibility and device reliability. Those percentages are invented illustrations, not Waterloo/Toronto estimates. With fewer than one encounter on average, product silence may reflect density rather than a bad algorithm.

The user chose public settings for early testing. Opt-in events or venue pilots could concentrate consenting users and make evaluation easier, but would test a narrower behavior than ambient citywide discovery. Waterloo's student population may offer recruitment opportunities; it also includes under-18s and therefore cannot be treated as an automatically adult population. No local demand, competitor penetration, or platform-share survey has yet been conducted.

Before citywide claims, research should distinguish a coffee-line dwell from a fast walk-by, user comfort in different contexts, tolerance for missed versus false matches, whether identity reveal is welcome, and whether a quiet app with few alerts still feels useful. Willingness to enable background Bluetooth/location permissions and battery concerns need direct user evidence.

## 10. Open decisions and follow-up research

### Questions for the user

- Selection among the recognition options remains open; the requested comparisons above should inform later user testing.
- What should count as a public setting, and which scope controls matter first?
- What counts as the intended opportunity: a few seconds passing, a sustained shared queue, or several minutes in one place?
- How important is knowing the person's identity before deciding to engage? How should someone gracefully ignore or decline?
- Which profile fields are true dealbreakers versus optional compatibility signals?

The user explicitly left recognition undecided and requested comparison of face preview, symbols, keywords, and hotter/colder haptics. Those options are covered above. Hidden full profiles until in-person connection, flexible future scopes, and public-only early testing are confirmed; a possible face-preview exception remains open.

### Follow-up research before implementation planning

1. Resolve recognition and connection consent, drawing on the comparisons above; clarify public-place definitions and expected encounter duration.
2. Extend current API/permission review and later validate locked-phone behavior on real devices, particularly cross-platform pairings. Documentation is not measured timing or battery evidence.
3. Read additional current product help/privacy material and independent historical reporting. happn's privacy policy, Thursday, and the original MIT project page remained blocked in tested requests. Do not turn this non-exhaustive comparison into a novelty claim.
4. Obtain full texts for the matching literature and investigate reciprocal recommendation evidence. Sage denied the tested publisher requests; Crossref metadata and the 2017 abstract were accessible.
5. Complete Canadian legal applicability research and local user research. Consent guidance was read, but no legal determination or local demand survey was performed.

Several sources initially returned `Tunnel connection failed: 403 Forbidden`; later requests to many of those domains succeeded. The cause was not established. Access status above reflects each actual result, not an assumption that saving a draft activated it. No network restriction was bypassed.

A network-only configuration draft was saved for the product, platform, academic, and Canadian privacy domains used by this research. Existing package-manager presets were preserved. Saving does not prove publication or fresh-task restoration; the environment tool says to review and save the changes in environment settings, then publish the environment to retain the intended configuration.

No application code, dependencies, framework selection, database design, or implementation plan was created. No phone-level behavior was tested. Repository changes in this task are limited to this research report.

## 11. Source register

All sources below were retrieved and read during this session unless explicitly marked otherwise. GitHub `main`/`master` links are mutable; historical source behavior is not a statement about every current OS version. Working copies of retrieved text are retained outside the checkout under `/workspace/research-sources/`.

- **S1 — Canadian Digital Service, COVID Alert app repository.** https://github.com/cds-snc/covid-alert-app — inspected README via raw GitHub. Supports retired status, React Native, and use of Apple/Google Exposure Notification; not ordinary Bluetooth background feasibility.
- **S2 — Health Canada/Public Health Agency of Canada, COVID Alert Privacy Assessment, February 2021.** https://github.com/cds-snc/covid-alert-documentation/blob/main/COVIDAlertPrivacyAssessment.md — inspected full text. Supports random identifiers, consent, protected OS integration, local matching, retention, and documented residual privacy risks. Its historical legal conclusions are specific to that application.
- **S3 — DP-3T, documents and research overview.** https://github.com/DP-3T/documents — inspected repository page and README, including links to security/privacy analyses and the 2022 deployment retrospective. Linked papers themselves were not read in this pass.
- **S4 — Google, Exposure Notifications internals.** https://github.com/google/exposure-notifications-internals — inspected README. Supports rotating identifiers/MAC coordination and explicitly limited historical snapshot status.
- **S5 — Android Open Source Project, BLE samples and PendingIntent scan example.** https://github.com/android/platform-samples/tree/main/samples/connectivity/bluetooth/ble and https://github.com/android/platform-samples/blob/main/samples/connectivity/bluetooth/ble/src/main/java/com/example/platform/connectivity/bluetooth/ble/BLEScanIntentSample.kt — inspected README and code, including service filters and comments about background power and screen-off batching. Not a validated production recipe or timing guarantee.
- **S6 — Android Open Source Project, BluetoothLeScanner, Android 11 branch.** https://github.com/aosp-mirror/platform_frameworks_base/blob/android11-release/core/java/android/bluetooth/le/BluetoothLeScanner.java — inspected historical API comments about screen-off unfiltered scanning and PendingIntent scanning. Do not use its older permission descriptions as current policy.
- **S7 — Google Nearby source repository and Connections README.** https://github.com/google/nearby and https://github.com/google/nearby/blob/main/connections/README.md — inspected raw READMEs. Supports Bluetooth/Wi-Fi peer discovery/data exchange; root README says the source collection is not an officially supported Google product. Check the separate supported SDK documentation before selecting anything.
- **S8 — DP-3T iOS SDK README.** https://github.com/DP-3T/dp3t-sdk-ios — inspected README, including exposure-notification background integration. Historical reference, not a recommended dating SDK.

- **S9 — happn official homepage, trust charter, and safety page.** https://www.happn.com/ ; https://www.happn.com/legal/trust-charter ; https://www.happn.com/safety — inspected. Charter contains apparent legacy content; no independent verification of its security claims. Privacy-policy link at https://support.happn.fr/hc/p/privacy was blocked.
- **S10 — Breeze homepage and FAQ.** https://breeze.social/ and https://breeze.social/faq — inspected, including matching/likes and availability sections. Vendor outcomes not independently validated.
- **S11 — Apple, Core Bluetooth background guide.** https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html — inspected; archived guide, not a current-device performance guarantee.
- **S12 — Android, background BLE and background location limits.** https://developer.android.com/develop/connectivity/bluetooth/ble/background and https://developer.android.com/about/versions/oreo/background-location-limits — inspected relevant sections, with version-specific qualifications retained.
- **S13 — Apple NameDrop and Core NFC.** https://support.apple.com/guide/iphone/namedrop-iphone-share-contact-info-iph1b6c664b7/ios and https://developer.apple.com/documentation/corenfc.md — inspected interaction steps and NFC overview; neither verifies a reusable dating-app phone-tap mechanism. Android NFC basics was also inspected: https://developer.android.com/develop/connectivity/nfc/nfc .
- **S14 — OPC, Guidelines for obtaining meaningful consent.** https://www.priv.gc.ca/en/privacy-topics/collecting-personal-information/consent/gl_omc_201805/ — inspected; redirects to the current longer privacy-for-businesses path. General guidance, not legal approval for this proposed app.
- **S15 — Crossref publication metadata and 2017 abstract.** https://api.crossref.org/works/10.1177/1529100612436522 and https://api.crossref.org/works/10.1177/0956797617714580 — inspected. Publisher requests at https://journals.sagepub.com/doi/10.1177/1529100612436522 and https://journals.sagepub.com/doi/10.1177/0956797617714580 returned 403. Full texts not appraised.
- **S16 — Google Play full-screen-intent guidance and Apple review guidelines.** https://support.google.com/googleplay/android-developer/answer/13392821 and https://developer.apple.com/app-store/review/guidelines/ — inspected relevant full-screen, background, push-notification, data-consent, and dating-category provisions. Recheck policies at submission time.
- **S17 — Crossref metadata, Eagle/Pentland (2005).** https://api.crossref.org/works?query.title=Social%20Serendipity&rows=2 — inspected; verifies title/authors/DOI/publication, not the system's exact functionality. MIT project page https://www.media.mit.edu/pia/Research/Serendipity/ was blocked.
- **S18 — Google, Nearby Connections overview.** https://developers.google.com/nearby/connections/overview — inspected. Supports Android/iOS availability and encrypted, mutually accepted connections; not measured passive discovery reliability.

**Other source gaps:** Thursday's tested homepage https://www.getthursday.com/ was blocked. Other products and historical services listed in the lead table were not directly verified. No claims about their current status, pricing, retention, or Canadian availability are made.
