# Run and test the prototype

The fastest runnable demonstration is the browser console. The Android APK and iOS
project add actual Bluetooth code, whose locked-phone behavior still needs device
trials. All profiles and eligibility are synthetic. Multiple introductions can
occur over time, with one active offer per installation.

## 1. Run the software demonstration on your Mac

Install Node.js 24 or later. From the repository root:

```sh
npm ci
npm run check
npm test
npm run demo
npm run demo:web
```

Open http://127.0.0.1:8787. Create two simulated participants, then start encounter
samples. Keep sampling running: the default dwell is 30 seconds and freshness is
30 seconds. Each panel represents a different installation. Click readiness in
both, show a QR in one panel, use the auto-filled challenge in the other (a
simulated camera scan), confirm in both, then fetch the synthetic profile. Try
decline, pause, stale evidence, disconnect and block as well.

`npm run demo` is a fast command-line simulation with an injected clock. The
browser uses real wall-clock dwell and the normal server policy. Neither is a
Bluetooth, push-display or battery result. The console is deliberately restricted
to loopback; do not forward the demo server to public or LAN clients.

For automated browser verification:

```sh
npx playwright install chromium
npm run test:e2e
```

## 2. Check native prerequisites

```sh
node tools/doctor.mjs
```

Use Android Studio with Android SDK 35, build tools 35 and a full JDK 17 or a
compatible Android Studio JDK. The checked-in Gradle wrapper pins Gradle 8.13 and
verifies its distribution checksum. On macOS, Android Studio normally configures
the SDK automatically; the command line can use:

```sh
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

Use a current Xcode supporting the friend's iOS version. The iOS deployment floor
is 16; the Android floor is 12/API 31. These are build configuration choices, not
claims that all those versions support the intended background experience.

## 3. Start the coordinator for phones

Stop the demo server. Native trials use a separate database:

```sh
npm start
npm run invite
```

`npm run invite` issues one enrollment code, usable once within one hour. Run it
again for each phone. Keep codes out of public screenshots. The app stores its
distinct API credential and proof key in Keychain/Android Keystore-backed storage.
The coordinator database contains prototype credentials and encounter associations;
it is private operator data, not anonymous storage. Native server logging is disabled
and no third-party analytics are installed.

For the Samsung alone, connect USB and use:

```sh
adb reverse tcp:8787 tcp:8787
```

Enter `http://localhost:8787` in the Android app. This is a development USB route,
not a wireless field setup. A physical iPhone cannot use the Mac's localhost.

For both phones on Wi-Fi, use an HTTPS coordinator reachable by both. Two options:

- Bind the coordinator to loopback behind an HTTPS reverse proxy using your own
  trusted hostname. Leave simulation disabled.
- Use a trusted development certificate for your Mac's LAN IP/hostname and direct
  TLS. For example, `mkcert` can issue a certificate with that IP as a subject
  alternative name. Install/trust that development CA on each test phone; on iOS
  enable its trust in certificate trust settings. The Android **debug** build
  trusts user-installed CAs. Do not disable TLS validation.

Start direct TLS with your actual paths (replace the placeholders):

```sh
HOST=0.0.0.0 TLS_CERT_FILE=/absolute/private/coordinator.pem TLS_KEY_FILE=/absolute/private/coordinator-key.pem npm start
```

Enter `https://YOUR_MAC_LAN_IP:8787` on both phones. Keep them on the same network,
allow the Mac's local firewall prompt if needed, and use a certificate valid for
that address. `DEMO_MODE` must be false/unset; binding a non-loopback address without
TLS is rejected. Wi-Fi is needed for the coordinator, not as evidence of proximity.

The optional `.env.example` documents configuration. `npm start` reads the process
environment; it does not automatically load a `.env` file. You can use Node's
`--env-file` support: `node --env-file=.env --import tsx services/coordinator/src/main.ts`.

## 4. Build and install Android

Open `apps/android` in Android Studio or run:

```sh
cd apps/android
./gradlew assembleDebug lintDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The app is **Proximity Lab**. Enter the coordinator URL and an invite, grant
Bluetooth/notification permissions, and enroll. Choose `both`, `central` (scanner),
or `peripheral` (advertiser), then start the 30-minute session. The Android variant
uses a visible connected-device foreground service with LOW_POWER filtered scans.
Its notification's Stop action also pauses participation. Battery-protection
exceptions are not requested automatically.

Diagnostic polling alerts are enabled initially and explicitly labeled. Disable
that switch for FCM delivery measurements. Screen-on UI refreshes also stop when
the activity leaves the foreground. This build does not implement a process-waking
PendingIntent scanner; it tests the foreground-service compromise first. Killing
the service/process is not a supported transparent-recovery promise.

The Google code scanner may download its module on first use. QR challenge text is
also displayed for manual transport while diagnosing camera issues; copying a
challenge is not evidence of physical distance. Both confirmations are still required.

## 5. Build and install iOS

Open `apps/ios/ProximityLab.xcodeproj`, select the ProximityLab target, select your
own signing team and a unique bundle ID if needed, connect the friend's unlocked
iPhone, enable Developer Mode if required, and Run. No Apple team ID or credentials
are embedded. The checked-in project works without XcodeGen; its deterministic
generator is `python3 tools/setup/generate-ios-project.py`.

Enroll with a new invite, allow Bluetooth/notifications, choose the radio role and
start a session. iOS uses Core Bluetooth background modes and service filters. It
attempts short authenticated exchanges and reconnection only while OS scheduling
permits. No periodic background execution is guaranteed. OS restoration is logged,
but expired/unknown session authorization is not restored automatically: reopen
and explicitly resume a session. The server's original session deadline is retained.

Diagnostic local alerts are initially enabled. These are requested after a BLE
callback and successful coordinator refresh; disable them for APNs measurements.
If no remote push is configured and the OS does not let that callback complete,
the iPhone may not alert: that is an experiment outcome, not a hidden workaround.

For unsigned simulator build checks on a Mac (not radio evidence):

```sh
xcodebuild -project apps/ios/ProximityLab.xcodeproj -scheme ProximityLab -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

## 6. Optional remote push configuration

The service implements APNs token auth and FCM HTTP v1 with durable retries. No
provider credentials were available during development, so live push has not been
verified. Without configuration, jobs report `unconfigured`; provider acceptance
is reported as `sent`, which still does not establish display or attention.

For Android, create a Firebase Android application matching `ca.proximity.lab`,
configure the public client values and private service-account path from
`.env.example`, restart the server, and enroll/configure the app with those values.
The app initializes Firebase programmatically and registers its token. No
`google-services.json` is required. Keep service-account files outside the repository.

For iOS, use provisioning that supports Push Notifications, enable that capability
on the Xcode target, and provide the APNs key, key ID, team ID and matching bundle
topic to the server. The default project intentionally omits push entitlements so
basic BLE installation does not require a push-capable team. Development builds
use the APNs sandbox unless `APNS_PRODUCTION=true`.

With diagnostic notifications disabled, create a fresh encounter and observe both
phone displays externally. Expiration/collapse settings cannot retract every
notification already displayed. Opening always checks current authorization.

## 7. First physical experiment

1. Start with one phone as scanner and one as advertiser. Verify a foreground
   exchange and server `proof_accepted` events without showing a real profile.
2. Swap roles. The Android-scans-background-iPhone direction may fail because of
   documented iOS advertising restrictions; record that separately.
3. Try both roles on each phone. Place them apart, lock both for five minutes,
   bring them into the test area, and start observer timing at entry.
4. Record detection, exchange, offer and actual display times. Continue with the
   30-minute idle, pocket/bag and obstruction variants. Use untethered, release-like
   runs for conclusions; an attached debugger can change behavior.
5. Run expiry, ignore, pause/offline, permission revocation and wrong-pair controls.
   Then evaluate the complete synthetic café flow only as a diagnostic demonstration.
6. Add two iPhones and a second Android for the remaining pairings. Follow the
   [brief](../product/cafe-encounter-and-feasibility.md) for sample sizes and battery
   runs. Do not mix polling/local-alert variants with remote-push trials in one group.

Starting a still-active server session resumes its existing deadline; it does not
extend it. To start a genuinely new session, pause first. A locally paused client
cannot sign new encounters even when the pause request is offline. The server may
retain its earlier state until it receives that request or evidence/session expires.
Connected profiles remain accessible until disconnect/block; pause alone is a
discovery control. Previously viewed material cannot be recalled.

## 8. Export and report observations

Export redacted events using each native app's export control. Those logs contain
callback diagnostics; they do **not** establish lock-screen display timing. Keep
separate observer JSONL in an ignored `raw-trials/` folder. Example shapes:

```json
{"kind":"trial","trial":"t01","pairing":"mixed","devicePair":"s26_iphone1","state":"locked5_local","entryAt":1000,"departureAt":181000,"displayAAt":41000,"displayBAt":51000,"simulated":true}
{"kind":"trial","trial":"n01","pairing":"mixed","devicePair":"s26_iphone1","state":"locked5_local","entryAt":1000,"departureAt":181000,"negative":true,"offerCreated":false,"simulated":true}
{"kind":"battery","device":"s26","condition":"idle","startPercent":90,"endPercent":88,"durationHours":8,"simulated":true}
```

These examples are simulated and automatically excluded. Use actual Unix-ms
observer times for physical trials, with recorded clock offsets. Omit a display
field when it was missed; do not omit the failed trial. Distinguish low-power,
force-quit and other states with separate labels. Use pseudonymous labels only.

```sh
npm run report -- raw-trials/observer.jsonl
npm run report -- raw-trials/observer.jsonl --json
```

The report keeps misses in the denominator, separates negative controls, reports
insufficient samples, and compares three idle versus three discovery battery runs.
Keep placement, radio config, build/OS, thermal notes and observer uncertainty in
the accompanying trial notes. Additional analysis is required before causal claims.

The server automatically removes expired raw records after seven days, performs
SQLite secure-delete/checkpoint/compaction, and does not configure backups. Exported
files and phone screenshots/recordings are outside that cleanup: delete them within
seven days of the block, including copies. Native diagnostics are bounded in memory,
not written to a persistent analytics log. Do not promise forensic erasure from an
OS, device backup or copied export. Keep only de-identified aggregate findings.
