# Café encounter and feasibility experiment

Draft: October 25, 2026 (America/Toronto).

Status: proposed product definition and experiment brief for discussion. No phone behavior has been measured. Recognition, timing, caps, and pass criteria below are recommendations, not previously agreed requirements. This document precedes platform selection and full system design.

## 1. Product definition

For adults who want to meet someone during everyday life, the app offers voluntary introductions to mutually eligible people already nearby, with at most one active introduction per person at a time. People may receive multiple introductions over time. People enable discovery, put their phones away, and decide whether to engage when alerted. Profiles remain hidden until both deliberately connect in person. There is no candidate feed, pre-meeting chat, map, distance display, or compatibility percentage.

The first encounter is a **sustained shared café space in Waterloo**, lasting roughly three minutes or more. A two-second crossing is outside this first test. Early sessions use recruited adult participants in an agreed public café area; this controls the test context without pretending Bluetooth can classify a place as public. Ambient discovery in arbitrary public places remains a later question.

Confirmed foundations from the research and subsequent review: multiple introductions over time, with at most one active introduction per person; 18+ only; bilateral eligibility; voluntary discovery and pause; public-setting early testing; minimal location collection; profiles hidden until intentional connection; initial platform chosen from feasibility evidence.

## 2. One encounter, end to end

Alex and Sam are fictional adult participants. Both have completed eligibility/preferences, enabled discovery for a 30-minute café test session, and allowed Bluetooth and notifications. Their phones are locked in pockets. Joining this test session establishes consent and context; membership alone must not trigger the BLE experiment's alert.

| Moment | Experience | Required behavior |
| --- | --- | --- |
| Arrival | Alex and Sam join the same café queue or seating area. | Seek fresh phone-to-phone evidence while locked. Do not require an app refresh, periodic unlock, or a manually selected person. |
| Candidate | Their devices produce evidence of sustained proximity. | Proposed starting dwell rule: evidence spanning 30 seconds. Determine the usable observation rule experimentally; RSSI is not a reliable metre measurement. Check both people's eligibility, availability, blocks, and attention limits. |
| Alert | Each receives one ordinary notification: “An introduction may be available. Open to check.” | Respect phone settings. No identity, sensitive preference, venue, or assertion that the other person has seen it. Delivery can differ between phones. |
| Choice | Each opens the app and chooses “I'm open to saying hello” or “Not now.” | Opening alone does not signal willingness. Show no profile or recognition cue yet. Offer expires two minutes after creation; opening it does not reset the deadline. |
| Recognition | Once both opt in and the opportunity remains current, both see the same temporary symbol and word, such as a leaf and “Maple.” | “If you feel comfortable, briefly show this screen so the other participant can recognize it. You can leave at any time.” Use shape and text rather than color alone; provide accessible labels. No direction or distance guidance. |
| Hello | They notice the matching screen and choose whether to talk. | The cue helps recognition; it does not identify or authenticate an account. Someone without a visible cue should not be treated as the intended person. If they cannot find each other, they can end the introduction. |
| Connection | After saying hello, one shows a short-lived QR, the other scans it, and both tap “Connect and share profiles.” | Bind the request to the current introduction and its two authenticated accounts. Recheck expiry, blocks, pause, and consent. Reveal only after both confirmations. A copied cue or QR scan alone must not unlock anything. |
| Afterward | Both can view the agreed profile and can later disconnect or block. | Profile access remains authorized server-side. No requirement to exchange numbers. Chat and future contact features are deferred. |

The initial two-minute offer includes recognition and connection, so users are never told to rush or chase someone. If usability testing shows it is too short, change it deliberately and rerun the timing evaluation. A longer expiry cannot substitute for evidence that the opportunity is still current.

Proposed availability rule: before issuing an offer and before enabling recognition, the latest authenticated encounter evidence must be at most 30 seconds old. If evidence is stale, withhold the next step. Missing radio evidence does not prove departure, but continued presence must not be assumed. Both apps will be open during QR confirmation; the final transport and freshness check need design before implementation.

### If either ignores, declines, or leaves

- Ignoring requires no action. Expiry ends the offer without profile reveal, reminders, or a rejection message to the other person. A generic “This introduction is no longer available” covers expiry and cancellation.
- If only one opts in, that person sees “Waiting for this introduction to be ready” until it closes. Do not expose delivery/read status or say the other person rejected them.
- “Not now” closes this offer for both. “Pause discovery” also stops new participation and cancels an unconnected offer; it must not merely silence one phone.
- Proposed attention limits: one open offer per person, one new offer per ten minutes, and no repeat offer for the same pair during that test session. Nonresponse is not a romantic rejection label.
- After either opts out, recognition stops on the next successful state refresh; any already seen cue cannot be recalled. Offline apps must not progress to recognition, confirmation, or profile reveal using cached authorization.
- A stale OS notification may remain visible. Opening it retrieves current state and cannot reopen the offer. A block revokes future access; already viewed material cannot be erased from another person's memory or screenshots.

### Why start with this recognition and confirmation

A shared symbol plus word preserves the hidden-profile rule and gives people a visible way to signal willingness. It requires a brief phone glance and may still feel conspicuous or awkward; that is a usability hypothesis. A face preview would require a separate identity-reveal decision. A spoken keyword can be tested later. Hotter/colder haptics would add ranging and following concerns before basic discovery is established.

QR with two confirmations is a practical initial connection candidate across platforms. It does not prove distance or conversation and remains vulnerable to relay without further controls. Bringing phones together remains an interaction goal to investigate, rather than an assumed NameDrop/NFC capability.

## 3. What the feasibility prototype must prove

**Primary question:** can supported ordinary apps, on two real locked phones, establish enough fresh encounter evidence to deliver a useful bilateral introduction during this café dwell, with acceptable battery cost and no geographic coordinates?

Build a diagnostic app with session controls, native BLE discovery/advertising, authenticated temporary test identities, timestamps, and generic alerts. Use fixed test eligibility and synthetic profiles. First separate radio feasibility from a minimal end-to-end offer and notification path. Do not build real dating profiles, a recommender, chat, payments, or production moderation for this experiment.

Before coding, review current APIs against the target OS versions and record the available devices, signing/build access, permissions, and supported transports. Swift/Kotlin test harnesses are reasonable for isolating lifecycle behavior; a shared framework can follow later. No special Exposure Notification privileges, silent-push wakeup loop, unsupported advertisement payload, or unbounded background runtime may be assumed.

### Device and state matrix

Start with two iPhones and two Android phones from different vendors, with an older supported device represented where possible. Record model, OS/build, app build, battery health, permission state, network, and power settings. This is an exploratory sample, not platform-wide certification.

| Pair | Required checks |
| --- | --- |
| Android–Android | Both scan/advertise roles; vendor power behavior; whether an ongoing foreground-service notification is necessary and acceptable. |
| iPhone–iPhone | Explicit service scanning, background advertising, suspension/restoration, and behavior after both have been locked for a sustained period. |
| Android–iPhone | Test both discovery directions separately. A successful mixed encounter may use an asymmetric path, but must complete authenticated pair association and timely alerts to both locked phones. |

Apple's documented background advertisement overflow is an explicit risk to Android discovering iPhone. Test iPhone discovering an Android advertiser and the subsequent exchange without assuming that reverse discovery is available. A foreground-only mixed demonstration does not establish background feasibility.

Run foreground controls first, then both phones locked after 5 and 30 minutes idle, with ordinary defaults. Include pocket/bag placement, body obstruction, quiet/busy café conditions, low power, screen-off/background suspension, OS process reclamation, user force-quit/force-stop, reboot, permission revocation, Bluetooth disabled, and network interruption/recovery. Record unsupported states honestly, including any necessary relaunch. Focus/DND or denied notification permission must not be counted as a transport failure or silently excluded from the report: distinguish detection, display, and user attention.

For each core pairing, conduct at least 30 independent three-minute encounters across multiple blocks/days. Reset encounter state between trials and vary who enters first. Start ground-truth timing when participants enter the marked test area; record separation and departure manually. Do not start the clock at first radio detection. Spread trials across available physical pairs and report each pair, not only an aggregate.

Use separate controls for passing briefly, adjacent rooms/through a wall, and staying well outside the agreed area. Include several devices together to detect duplicate offers and wrong-pair confirmation. A 30-second dwell filter needs observations distributed over that interval, not just a cached first sighting replayed later.

### Proposed decision criteria

These are product targets to agree before collecting results. They are not established industry limits or observed performance.

| Measure | Proposed gate | Reporting requirement |
| --- | --- | --- |
| Bilateral useful alert | At least 90% of valid core encounters show both alerts within 60 seconds of entering the test area, including dwell; at least 95% within 120 seconds. | Report numerator/denominator per physical pair and state, uncertainty, and censored failures. With 30 trials these correspond to at least 27 and 29 successes; evidence remains preliminary. |
| Latency | Report time to first detection, authenticated pair association, offer creation, each notification display, and app opening separately. | Show median/p95 where sample size supports it; use the slower phone for bilateral timing. Report misses instead of computing latency only on successes. |
| Wrong-context offers | No more than 5% of negative-control trials create an offer. | At least 30 controls per pairing across the three conditions; list counts by condition. Thirty trials do not tightly establish a 5% population rate. Failure here may require venue boundaries or abandoning a same-space claim. |
| Battery | Proposed budget: no more than 3 additional battery percentage points per phone over an eight-hour discovery run versus matched idle baseline. | At least three baseline and three discovery runs/device, comparable conditions, no debugging tether. Report spread, thermal behavior, and OS energy diagnostics; percentage readings alone are coarse. |
| Cancellation/reveal | No unauthorized profile reveal or successful replay, wrong-pair confirmation, post-expiry confirmation, or confirmation after a current block/pause. | Exercise explicit race and offline cases. Any observed failure blocks the next pilot until corrected. Zero observed failures is not a security proof. |
| Data | No coordinates or real profile/preferences in radio data, pushes, or diagnostic logs. | Inspect payloads, logs, storage, network destinations, and deletion behavior. Document permission requirements separately from actual coordinate collection. |

Core performance gates apply to the supported locked, connected, normal-power states. Low power, force-stop and other adverse states get separate results and a support decision; a hidden requirement to disable battery protections or repeatedly reopen the app is a material product limitation.

Instrument application callbacks and provider responses, but do not equate push-provider acceptance with notification display. Use observer notes/video of test phones where consented to establish actual display timing; record clock offsets. Debuggers, frequent log uploads, and active screens can change background behavior, so run release-like untethered trials too.

### Experiment data boundary

Use random participant/device labels and rotating encounter aliases, with only the timestamps and radio/network diagnostics needed to explain a trial. Specify a supported alias exchange rather than assume arbitrary iPhone advertisement bytes. Do not transmit stable account IDs or matching preferences over radio.

Proposed handling: local raw diagnostics and temporary server trial records deleted within seven days of each block; keep only de-identified aggregate results and configuration descriptions. Avoid collecting Bluetooth addresses in durable logs. Verify deletion across exports, server logs, and backups, or document the actual limitation. No advertising/behavioral analytics SDK. Even without GPS, a resolvable encounter record and known test venue reveal presence; make that explicit to participants.

## 4. How results determine the next step

| Result | Decision |
| --- | --- |
| All three pairings pass in supported states | Proceed to a small system design and consent/recognition usability test. Expand device coverage before broad platform claims. |
| Only one platform pairing passes | Consider a clearly limited single-platform pilot after checking local tester/device availability. Do not choose solely on build convenience. |
| Detection works only with foreground apps or explicit activation | Evaluate a venue-session experience as a changed product promise. Report it separately from passive discovery. |
| Timely BLE works but wrong-context offers are frequent | Revise what “nearby” means, add justified context controls, or test a venue-assisted approach. Do not present radio range as same-room certainty. |
| Timing or battery fails | Narrow the promise or stop passive discovery work before building the dating MVP. Do not compensate with a more complex matching model. |

A venue-only comparison should use the same timing instrumentation, but label its trigger as session participation rather than measured phone proximity. Its success would demonstrate a different experience.

After technical feasibility, test the recognition flow with consenting adults, including accessibility needs. Measure correct identification, accidental approaches to nonparticipants, time looking at phones, ease of ignoring/leaving, and comfort with the cue and reveal. Technical success is insufficient if people feel pressure or cannot find each other comfortably. Broad public recruitment follows age-assurance, reporting, moderation, and Canadian privacy work identified in the research.

An exploratory conversation with Near's creator could ask about detection inputs and radius, locked/background performance by OS, battery, attendance/arrival confirmation, retention, and awkward or missed introductions. It supplies leads to test, not substitute performance evidence. No outreach is part of this document.

## 5. Source grounding and remaining decisions

All project documents were reviewed: the repository README, [initial research](../research/proximity-dating-research.md), and [follow-up research](../research/follow-up-competition-and-system-options.md). The research-source directory contains supporting captures, code extracts and retrieval scripts; it is not another agreed product specification. Selected underlying Apple API and Near README captures were also checked. This brief adds proposed decisions, not new external research or device results.

Relevant anchors: initial research §§1, 4–7, 9–10 (requirements, privacy, feasibility, recognition, public trials); follow-up §§3, 5, 7, 9–10 (Near, background APIs, notifications, implementation boundaries, confirmation). Follow-up source references R9–R12, R16–R17, R21–R22 carry the technical and competitor evidence. Later findings about happn's policy and Near supersede the first report's earlier access gaps and closest-competitor assessment.

The immediate review decisions are the sustained encounter duration, symbol/word recognition, explicit mutual readiness, QR confirmation, and proposed timing/battery gates. Before implementation, inventory physical devices and macOS/iOS signing access. Platform and discovery architecture remain open until the experiment supplies evidence.
