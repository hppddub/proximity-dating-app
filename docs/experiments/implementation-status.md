# Prototype implementation evidence

Completed software implementation: October 26, 2026 (America/Toronto).
Validated source checkpoint: `5b4615b` on `prototype/feasibility`.

The software prototype is runnable. **Physical locked-phone reliability, battery
use, same-space accuracy, and live APNs/FCM delivery remain unmeasured.**

Update October 30: the owner's first phone test shows our Samsung advertisement
visible in nRF Connect on an iPhone. See [physical radio observations](first-radio-observations.md)
for the screenshots/log assessment and next experiment. Lock-state timing and a
full authenticated phone-to-phone exchange remain unverified. Software build/check
results below refer to the original validated implementation checkpoint.

## Implemented

| Plan phase | Delivered software | Evidence boundary |
| --- | --- | --- |
| 0: setup/protocol | Versioned protocol, toolchain configuration, Android wrapper, Xcode project, enrollment, runbook and interoperability fixture. | Device inventory is based on the owner's Mac/Samsung/iPhone access; exact phone OS/signing was not inspected remotely. |
| 1: radio diagnostics | Kotlin and Swift native service-filtered scan/advertise and framed GATT exchange; role selection; callback logs/export; expiry and pause controls. | Both compile. Samsung advertisements have been observed in a foreground iPhone scanner; an authenticated exchange remains unverified. Android currently uses a foreground service; a process-waking PendingIntent scanning variant is not implemented. |
| 2: fresh authenticated encounter | Secure client credential storage, rotating session aliases, dual HMAC transcript verification, nonce replay prevention, dwell/freshness and duplicate handling. | Cross-language golden vector passes on Node, Android JVM and Swift/macOS. Simulated proofs exercise the coordinator; distance and live-relay resistance are not established. |
| 3: coordinator/alerts | Transactional offer reservations, finite sessions/offers, one active introduction, cooldowns, repeat-pair suppression, generic closure, durable outbox, optional APNs/FCM adapters, HTTPS support. | Automated state/authorization tests pass. Remote provider credentials were unavailable; missing configuration is reported as `unconfigured`. Local/polling diagnostic alerts are labeled and can be disabled. |
| 4: evaluation tooling | Observer-record validation, state/device grouping, missed-display denominator, negative-control and battery summaries, example data and runbook. | All sample observations are marked simulated and excluded from physical results. No physical study or eight-hour battery run was performed. |
| 5: synthetic café demo | Mutual readiness, shared cue, QR creation/scanning, two confirmations, server-gated synthetic profiles, disconnect and block, plus browser simulation console. | End-to-end software demo passes. It was implemented to make the flow reviewable; a participant pilot remains conditional on physical feasibility and usability work. |

## Checks completed

- **33 Node/TypeScript tests passed**, including competing offers, transactional
  rollback, nonce replay, tampered signatures, stale evidence, wrong-account access,
  expiry, pause/block races, safe confirmation retries, generic decline handling,
  sequential introductions, durable storage/outbox behavior and report calculations.
- TypeScript checking and the command-line full-flow simulation passed.
- **Chromium end-to-end test passed** against a real running coordinator: 30-second
  simulated dwell, mutual readiness, QR, both confirmations, authorized synthetic
  profile fetch and block revocation. Simulated radio input is explicitly labeled.
- **Android `assembleDebug`, `lintDebug`, and `testDebugUnitTest` passed** locally and
  in CI. Two JVM interoperability/key-validation tests passed; lint has zero errors
  and non-blocking prototype warnings (including English UI strings).
- **iOS unsigned simulator build passed on macOS CI**, including the final Swift
  changes. Swift protocol interoperability check passed. This does not establish
  physical device signing, background behavior or camera performance.
- `npm audit` reported **zero vulnerabilities** with the pinned dependency tree.
- Trusted-certificate HTTPS health check passed on a local test listener; native XML,
  plist files and project document links were checked.
- Packaged Android debug APK signature verification passed.

[Final source CI run — coordinator, Android and iOS all passed](https://github.com/hppddub/proximity-dating-app/actions/runs/40293530942).
CI uploads `proximity-lab-debug-apk`; that build is unsigned for store distribution
but signed with a development/debug key for installation. A separate local debug
APK is also available in the chat workspace at
`/workspace/proximity-dating-app/artifacts/proximity-lab-debug.apk` (ignored by Git).
Its SHA-256 is `94dc728541c2f1217ce27d57f7f16dc63ab9952a3f2f59fe95d9cb764fc4535f`.

## Run it

From the repository root with Node 24+:

```sh
npm ci
npm run demo:web
```

Open **http://127.0.0.1:8787**. Create two simulated participants and start samples;
keep them running as the 30-second dwell completes. The two panels let you exercise
readiness, QR exchange, connection, expiry, pause, disconnect and block. The
command-line equivalent is `npm run demo`.

For phones, stop the loopback simulation, start `npm start`, generate separate
single-use invites with `npm run invite`, then follow the
[device installation and experiment runbook](runbook.md). An HTTPS endpoint shared
by the phones is needed for untethered mixed-device trials. The runbook includes
local development TLS, iOS signing, optional push configuration and observation
formats. No production hosting or public launch was performed.

## Limits to keep visible

- No physical phones were attached to the development environment. The owner's
  scanner observations support one-direction advertisement visibility; they do
  not establish mutual discovery or both-phones-locked timing.
- An iOS simulator build is a compiler/linker check, not a radio test. Reclamation,
  force-quit/force-stop and reboot recovery must be measured separately. The iOS
  client intentionally requires explicit session resume after process restoration.
- Diagnostic Android polling and iOS local alerts are different from live provider
  delivery. Do not pool those trial variants or count `sent` as actual display.
- BLE evidence and signed transcripts do not prove physical distance or voluntary
  conversation. A fixed experimental service can reveal app membership. The
  operator can link aliases to enrolled installations; no anonymity claim is made.
- The server deletes expired raw records after seven days and compacts SQLite.
  Exported files, device recordings, backups and copies require separate deletion;
  there is no forensic-erasure guarantee.
- Only synthetic profiles and controlled test installations are supported. Real
  eligibility/age assurance, production account recovery, moderation, store release
  and production infrastructure are outside this feasibility prototype.

The next evidence needed is a foreground and then locked Samsung–iPhone exchange,
followed by two iPhones and a second Android. The runbook and report tools are ready
for those measurements; the platform/discovery decision is still open.
