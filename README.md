# Proximity Lab

A working software prototype for the proximity-dating feasibility experiment:
Android and iOS Bluetooth diagnostic clients, a Node.js coordinator, and a minimal
browser console for exercising the complete synthetic encounter flow.

Multiple introductions over time; **one active introduction per person**. No real
profiles, location history, swipe feed, or compatibility model.

## Try the prototype

Requires **Node.js 24+**. From the repository root:

For a first checkout in Windows PowerShell (Git required):

```powershell
Set-Location $env:USERPROFILE
git clone --branch prototype/feasibility https://github.com/hppddub/proximity-dating-app.git
Set-Location proximity-dating-app
node --version
```

The following commands work in PowerShell, Command Prompt, and Unix shells. Run
them from the folder containing `package.json` and `package-lock.json`:

```sh
npm ci
npm run demo
npm run demo:web
```

Open **http://127.0.0.1:8787**. Create two simulated participants, start samples,
wait 30 seconds for dwell, opt in with both, exchange the QR challenge, confirm
with both, then fetch the synthetic profile. Ignore/decline, expiry, pause,
disconnect, and block are supported. The console labels simulated evidence;
it does not establish Bluetooth or battery performance.

For native phones, use `npm start` (simulation off), `npm run invite`, and the
[build/install/device runbook](docs/experiments/runbook.md). Android source is under
`apps/android`; the checked-in iOS project is `apps/ios/ProximityLab.xcodeproj`.
Push providers are optional to start the software; unconfigured delivery is shown
explicitly. Diagnostic local/polling alerts are separate measurement variants.

With a Windows PC, Samsung, and iPhone, start with the
[first Bluetooth radio check](docs/experiments/first-phone-check-windows.md).
`npm run phone:test` starts a USB-connected Samsung test coordinator and prints an
enrollment invite; the iPhone can observe advertisements with nRF Connect before
the full iOS app is installed using a Mac.

For the next stage, follow the [Mac setup from scratch](docs/experiments/mac-two-phone-setup.md).
`npm run phone:mac` prepares the shared HTTPS coordinator, public certificate and
two enrollment invites for the native Samsung–iPhone test.

## Verify

```sh
npm run check
npm test
npm run demo
npx playwright install chromium
npm run test:e2e
```

Android: `cd apps/android && ./gradlew assembleDebug lintDebug testDebugUnitTest`.
CI also builds iOS on a macOS runner without signing. See
[implementation evidence and limits](docs/experiments/implementation-status.md)
for the actual results. Compilation and simulation do not establish locked-phone
feasibility; that requires the physical trials in the runbook.

## Project documents

- [Product encounter and feasibility criteria](docs/product/cafe-encounter-and-feasibility.md)
- [Prototype development and implementation plan](docs/plans/feasibility-prototype-implementation.md)
- [Build, installation and experiment runbook](docs/experiments/runbook.md)
- [Implementation evidence and limitations](docs/experiments/implementation-status.md)
- [Initial research](docs/research/proximity-dating-research.md)
- [Follow-up research and system options](docs/research/follow-up-competition-and-system-options.md)
