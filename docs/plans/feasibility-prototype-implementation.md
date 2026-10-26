# Feasibility prototype: development and implementation plan

Date: October 26, 2026 (America/Toronto).

This plan implements the [café encounter and feasibility brief](../product/cafe-encounter-and-feasibility.md). It targets a diagnostic prototype followed, conditionally, by a small demonstration of the encounter. It does not select the eventual production mobile platform or authorize a public launch. No application code or device measurements exist yet.

## Objective and scope

Demonstrate whether ordinary apps can discover and associate two nearby, locked phones promptly, then deliver an expiring introduction to both, without collecting geographic coordinates and within a measured battery budget.

Multiple introductions are allowed over time; each person has at most one active introduction. Keep the brief's three-minute encounter, proposed 30-second dwell, two-minute offer, freshness rules, and attention limits configurable and versioned. Their initial values are experimental hypotheses.

Build in this order: native radio diagnostics → authenticated encounter exchange → minimal server-coordinated alerts → measured trials → optional recognition and synthetic-profile reveal. Do not build real dating profiles, a recommendation engine, chat, payments, maps, UWB, or a production admin system.

## Available hardware and execution boundaries

| Resource | Current status | Action before testing |
| --- | --- | --- |
| Mac | User has one. | Record macOS version and Xcode compatibility; install/select Xcode and command-line tools. Verify physical iPhone build/signing. |
| Samsung S26 Ultra | User has one. | Record exact model/Android build; enable developer options and USB debugging; install Android Studio/SDK and a compatible JDK on the Mac. |
| Friends' iPhones | Access available; models, OS versions, and simultaneous availability unknown. | Borrow one for the first mixed test and two together for iPhone–iPhone. Record model, OS, battery health, and consent to diagnostic collection. |
| Second Android | Not yet identified. | Borrow one, preferably another vendor, before Android–Android conclusions. |
| iOS signing/push access | Not yet confirmed. | Verify development signing, capabilities, and provisioning for each friend's phone. Check Apple Developer membership/access needed for remote push and the chosen distribution method before the alert milestone. |

Code and server checks can run in this workspace. Xcode builds/signing and physical-device trials run on the user's Mac and phones. Emulators and automated checks cannot establish locked-phone BLE behavior. No credential values belong in the repository or exported diagnostics.

## Implementation choices for this experiment

| Layer | Proposed choice | Reason |
| --- | --- | --- |
| Android | Kotlin, a small Compose UI, Android BLE/GATT APIs. | Direct access to scanning, advertising, lifecycle callbacks and power diagnostics. |
| iOS | Swift, a small SwiftUI UI, Core Bluetooth. | Direct access to background modes, service filtering and restoration behavior. |
| Shared contract | Versioned JSON schemas, protocol specification, fixtures and event vocabulary. | Both apps implement the same experiment without requiring a shared UI framework. |
| Coordinator, added after radio progress | Node.js/TypeScript, Fastify, SQLite transactions and a durable outbox in one process. | Small, inspectable test service; enough for controlled trials and atomic active-offer reservations. This assumes one service instance and durable storage, not horizontal scaling. |
| Notifications | Local diagnostic alerts first; APNs and FCM for the end-to-end coordinated offer test. | Distinguish radio callback availability from network/provider delivery. Local-alert success alone cannot pass the coordinated-alert gate. |
| Reporting | Exported redacted JSONL events plus a Node.js report command producing CSV/Markdown. | Reproducible trial results without a dashboard or analytics SDK. |

These are prototype implementation choices. React Native/Expo can be reconsidered after native radio behavior is understood. Do not introduce a BLE wrapper that lacks peripheral/GATT-server functionality.

Suggested repository structure:

```text
apps/android/            Kotlin diagnostic app
apps/ios/                Swift diagnostic app
services/coordinator/    Test enrollment, encounters, offers, push worker
packages/protocol/       Schemas, fixtures, protocol and event definitions
tools/experiments/       Trial validation and reporting commands
docs/experiments/        Device inventory, runbook, redacted findings
```

Keep raw participant-linked recordings and diagnostics outside Git. Pin toolchain/dependency versions and commit a lockfile for npm tooling. Add each scaffold only when its phase begins.

## Phase 0 — Make the experiment runnable

1. Inventory actual devices, OS versions, signing access and borrowing schedule. Establish a build/install/export path for each platform.
2. Recheck current platform documentation against those OS/SDK versions. Record required Bluetooth/notification permissions, iOS background modes, and Android service restrictions. Do not infer capabilities from the phone's product name.
3. Write a short radio protocol and event-schema specification. Choose a fixed experimental service UUID and characteristics for version, ephemeral identity exchange, and challenge/response. Identify what can be advertised on each OS; put exchange data in GATT where supported rather than assuming arbitrary iPhone advertisement bytes.
4. Define trial IDs, observer timing, placement and separation rules, data deletion, and configuration versions. Capture ground truth independently of discovery callbacks.
5. Create minimal app projects and prove each can install, show device/test status, request permissions in context, and export a redacted diagnostic file.

**Exit:** apps install on the Samsung and at least one iPhone; a reproducible runbook exists. Missing signing or hardware access is recorded as a dependency, not passed over using simulator results.

## Phase 1 — Establish the radio path with two real phones

Implement Android first because the Samsung is immediately available, then the iOS counterpart as soon as an iPhone can be borrowed. Move to mixed-phone testing early; do not finish an Android product before discovering an iOS constraint.

The diagnostic UI needs only: start/pause a time-limited session; advertise/scan/both role selection; permission and Bluetooth status; recent diagnostic events; configuration/build ID; export/reset. Use temporary test labels, not real dating identities.

Implement filtered scanning, advertising, a minimal GATT service/client and a short versioned payload exchange. Log discovery, connection, service discovery, read/write, disconnect and errors separately. This first transport-only exchange is not yet authenticated and must not authorize offers or reveal.

On Android, compare supported filtered PendingIntent scanning and lifecycle behavior with a documented foreground-service variant where permitted. Start any necessary service from a deliberate session action, use the appropriate service type/permissions, and record its persistent notification. Do not silently disable Samsung battery protections.

On iOS, use explicit service filters and declared central/peripheral background modes. Implement applicable state restoration and record what actually restarts after OS reclamation. Restoration is not a promise to recover from user force-quit. Do not use silent pushes or background timer loops to keep BLE alive.

Test these paths independently:

- Android scanner → Android advertiser, once the second Android is available.
- iPhone scanner → iPhone advertiser, once two iPhones are available.
- Android scanner → iPhone advertiser.
- iPhone scanner → Android advertiser, including a completed data exchange and response to the Android peer.

Apple's background advertising restrictions may prevent symmetric mixed discovery. A working asymmetric path is acceptable if it can associate and later notify both locked devices. Discovering an advertiser is only the first event; measure completion of the exchange too.

**Exit:** repeated untethered foreground controls and initial locked trials document which paths work. A candidate path must work after both phones have been locked for 5 and 30 minutes. If no useful locked path exists for a pairing, investigate once with bounded protocol/lifecycle changes, then record the limitation before building more around it.

## Phase 2 — Establish fresh, authenticated test encounters

Add the coordinator and enroll controlled test installations using expiring invitations and securely stored per-installation credentials. No public signup. Use synthetic eligibility fixtures. Specify and test authentication before interpreting any peer payload as trusted encounter evidence.

Implement an authenticated challenge/response using established cryptographic libraries, short-lived aliases, fresh nonces, and a transcript bound to both test installations and the session. Verify enrollment credentials, expiry, and replay protection. Do not invent encryption primitives or broadcast stable identities. Decide the exact credential format and rotation in the protocol document before coding this exchange.

Authentication establishes which enrolled test device participated; it does not prove physical distance or prevent a live relay. Document that limit. Both phones need not independently discover each other if one authenticated exchange can establish the pair.

Implement dwell and freshness using observations or supported exchange events spread across time. A single cached discovery plus a 30-second timer is insufficient. Test whether a short-lived GATT exchange can supply fresh evidence within OS execution limits; do not keep arbitrary long-lived connections solely to evade suspension. If usable evidence cannot be refreshed, report that the proposed dwell/freshness rule fails.

Add ingestion validation, duplicate suppression, expiry, session pause and deterministic synthetic mutual eligibility. Offline encounters must not become offers after their evidence expires. Build configuration should let a trial bypass dwell for radio diagnosis, while clearly excluding such runs from product acceptance results.

**Exit:** both locked phones can complete a fresh authenticated exchange on each claimed supported path; replayed, expired, malformed or unenrolled submissions cannot create a valid encounter.

## Phase 3 — Coordinate an expiring introduction and alerts

Implement the smallest authoritative server state:

```text
eligible fresh encounter → offered → both ready → connected
                             ↘ expired / declined / cancelled
```

The `connected` transition and reveal are implemented only in Phase 5. In this phase, implement offered/readiness/terminal states and notification delivery. Notification sent, delivered, displayed and opened are separate measurements, not introduction states or proof of readiness.

Use transactions to reserve both participants, create one offer and write outbox jobs. Enforce at most one active offer per participant across all states that reserve attention. Release reservations on terminal states, using authoritative expiry checks even if cleanup is delayed. Allow later introductions subject to configured cooldowns; suppress duplicate pair offers in a session.

Implement authenticated session controls, encounter submission, current-offer fetch, ready/decline/pause actions, and push-token registration. Every transition rechecks current membership, eligibility, blocks, freshness where required and expiry. Use idempotency and bounded retries. Keep client requests pair-scoped; do not expose a nearby-user enumeration endpoint.

Send generic, expiry-aware APNs/FCM notifications from the outbox. Use suitable TTL/expiration and collapse settings, record provider outcomes, and handle invalid tokens. Never include hidden identity or preferences in a push. Opening always fetches current state; it cannot revive a stale offer. A foreground refresh or live connection may update UI, but background correctness cannot depend on a permanent WebSocket.

Configure an HTTPS test endpoint reachable by both phones when off the development Wi-Fi. Document deployment, storage and deletion before field trials; choose hosting at implementation time. Test credentials stay in service secrets and OS secure storage. Do not expose a local development server publicly as an unprotected shortcut.

**Exit:** both phones receive the same offer while locked, with per-phone display timing observed. Decline, pause, expiry, duplicate submissions and offline recovery behave correctly. Local notifications and provider acceptance are not substitutes for this end-to-end test.

## Phase 4 — Run the feasibility study and decide

First debug with a few trials, freeze a candidate build/configuration, then collect the brief's core sample: at least 30 independent three-minute encounters per pairing, distributed across devices and blocks/days. Report state-specific counts; do not mix foreground successes into locked results. Expand the sample if a state has too little evidence. An unavailable second Android means that pairing is untested.

Run normal locked trials after 5 and 30 minutes idle; pocket/bag and obstruction variants; negative controls for pass-by, adjacent room/wall and separation; then low-power, process reclamation, force-stop/quit, reboot, Bluetooth/permission changes, network loss and multiple-neighbor tests. Record required recovery actions.

Collect at least 30 negative controls per pairing, broken down by condition. Run at least three matched idle-baseline and three discovery battery runs of eight hours per device, untethered under comparable conditions. Start battery screening earlier so obviously expensive radio settings do not consume a full study.

The report command must join observer ground truth with client/server events, include all misses, flag missing observations and clock uncertainty, and distinguish detection, exchange, server processing, provider response, notification display and user open. Check the tool against hand-calculated sample fixtures.

Use the brief's proposed gates:

| Criterion | Initial target |
| --- | --- |
| Both alerts visible | At least 90% of core encounters within 60 seconds from entering the area, and at least 95% within 120 seconds; dwell included. |
| Wrong-context offers | At most 5% of negative controls; report condition counts and small-sample uncertainty. |
| Battery | At most 3 additional percentage points over eight hours versus matched idle baseline, per device. |
| Authorization | No observed successful replay, wrong-pair access or unauthorized progression after expiry/block/pause. |
| Data | No coordinates or real profile/preferences in radio, pushes or diagnostics; verify the specified deletion behavior. |

**Exit:** publish a repository findings document with raw counts, timing summaries, battery spread, supported states, limitations and a proceed/change/stop recommendation per pairing. Retain only permitted redacted artifacts. No universal platform claim follows from this small device sample.

If a pairing fails, first distinguish radio/OS failure, inadequate freshness, network delay, push delivery and disabled alerts. Change one variable at a time and rerun affected trials. If the acceptable path requires a foreground service, frequent reopening, venue check-in or a narrower device set, state the changed product promise explicitly. Passing one platform does not establish the others.

## Phase 5 — Conditional café-flow demonstration

Proceed on the supported configurations after Phase 4. Build a minimal native experience using the brief's mutual readiness, shared symbol/word, QR and two confirmations. Use synthetic profiles only.

Bind a short-lived, single-use QR challenge to the current introduction and authenticated pair. A scan requests connection; it does not grant profile access. Commit both confirmations and final authorization checks atomically, then allow the two accounts to fetch synthetic profiles. Recheck authorization on every profile read, and do not return hidden profile fields or media URLs beforehand. Implement disconnect/block and revoke future access.

Add meaningful automated tests for expiry boundaries, competing offers, retries, pause/block versus confirmation races, wrong-account reads, QR replay and offline cached actions. Manually test permissions, accessibility and the locked-phone flow on both platforms. Test independent introductions over time so the concurrency limit does not become a lifetime limit.

Run a small observed session with consenting adult participants. Measure identification errors, accidental approaches, phone effort, ability to ignore/leave and comfort. Do not interpret this as romantic compatibility validation or a public-launch readiness test.

**Exit:** one complete voluntary encounter works on the supported devices; ignored/declined offers close safely; several sequential introductions are possible; profiles remain gated; a findings note records usability issues and the next product decision.

## Work division and delivery cadence

Development work here covers source, protocol, server, automated checks, runbooks and analysis tooling. The user's Mac supplies Xcode/signing and device installation; the user and friends supply physical trials and observer notes. Feed redacted exports back into analysis rather than describing a run only as “it worked.”

Use one reviewable milestone per phase, with build/install instructions and a short evidence note. Start with the Samsung plus one borrowed iPhone. Arrange the second iPhone and Android while those builds progress. Only require information when it blocks the relevant milestone.

Indicative effort for an experienced developer with toolchains and devices available: 1–2 active days for setup, 3–6 for radio diagnostics, 2–4 for authenticated exchange, 2–4 for coordinated alerts, 2–4 for trial tooling/analysis, and 3–5 for the conditional café demo. These are planning ranges, not delivery commitments. Borrowing, signing, background-radio debugging and the repeated eight-hour battery runs can extend calendar time substantially. Re-estimate after the first mixed locked-phone results.

The first implementation slice is **Phase 0 plus foreground and locked mixed-phone GATT diagnostics**, followed by a short evidence review. Do not install a full application stack before establishing that path. The complete prototype is done when the feasibility report supports a platform/discovery decision; the conditional demo adds evidence about the proposed human interaction.

## References

- [Café encounter and experiment brief](../product/cafe-encounter-and-feasibility.md): encounter behavior, proposed thresholds and privacy boundary.
- [Initial research](../research/proximity-dating-research.md): confirmed requirements, platform feasibility and safety questions.
- [Follow-up research](../research/follow-up-competition-and-system-options.md): §§5, 7, 9–10 and sources R9–R12, R16–R17, R21 for BLE, notifications, native integration and reveal constraints.

This is an implementation plan grounded in the existing research. Exact SDK support and signing/distribution requirements must be checked during Phase 0; no new platform performance evidence is claimed here.
