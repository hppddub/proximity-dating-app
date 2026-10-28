# First real Bluetooth check: Windows, Samsung and iPhone

Goal: see the Samsung's actual experimental Bluetooth advertisement on the iPhone,
then see whether it remains visible when the Samsung is locked. This is a radio
smoke test, not authenticated matching, mutual alerts, measured range or a full
locked-phone feasibility result. The iPhone scanner stays open in this test.

Use our Android APK on the Samsung and **nRF Connect for Mobile** by Nordic
Semiconductor on the iPhone. Its Canadian App Store listing was checked October 28,
2026: free, minimum iOS 17, https://apps.apple.com/ca/app/nrf-connect-for-mobile/id1054362403?uo=4.
Our full iPhone app still needs signing/installation using a Mac and Xcode.

## Prepare the devices

Download `proximity-lab-debug.apk` from the chat to the Windows computer's Downloads
folder. On the iPhone, install nRF Connect and grant its Bluetooth permission.
Use a USB data cable for the Samsung.

On Samsung, enable Developer options by opening Settings → About phone → Software
information and tapping Build number seven times. Then enable USB debugging under
Developer options, connect to the PC, and accept the phone's USB debugging prompt.

## Prepare the Windows USB tools

These PowerShell commands download Google's official small platform-tools package;
Android Studio is not needed just to install this APK. They do not install our iOS app.

```powershell
$labTools = Join-Path $env:LOCALAPPDATA "ProximityLab"
$labAdb = Join-Path $labTools "platform-tools\adb.exe"
if (-not (Test-Path $labAdb)) {
    $labZip = Join-Path $env:TEMP "proximity-platform-tools.zip"
    Invoke-WebRequest "https://dl.google.com/android/repository/platform-tools-latest-windows.zip" -OutFile $labZip
    Expand-Archive $labZip -DestinationPath $labTools -Force
}
& $labAdb devices
```

The Samsung should have status `device`. If it says `unauthorized`, unlock the
Samsung and accept the debugging prompt, then run the last command again. If it
does not appear, check the data cable/USB connection before proceeding.

Install the downloaded APK and forward the coordinator port over USB:

```powershell
& $labAdb -d install -r "$env:USERPROFILE\Downloads\proximity-lab-debug.apk"
& $labAdb -d reverse tcp:8787 tcp:8787
```

If the APK was saved elsewhere, substitute that actual file path. Keep only the
Samsung connected as an Android USB test device when using `-d`.

## Start the real-phone coordinator

Stop the browser demo with Ctrl+C in its PowerShell window. From the existing
project folder, pull the latest branch, install dependencies and start:

```powershell
git pull origin prototype/feasibility
npm ci
npm run phone:test
```

This new command disables simulation, uses a separate phone-test database, prints
a single-use enrollment invite and starts the coordinator. Leave the window open.
The USB route is for initial diagnostics; do not use this tethered setup to draw
battery or final background-reliability conclusions.

## Run the radio check

1. Open **Proximity Lab** on the Samsung. Enter `http://localhost:8787` as its
   coordinator URL and the invite printed in PowerShell. Grant Bluetooth and
   notification permissions, then enroll the installation.
2. Set its radio role to **peripheral** and start the 30-minute session. A persistent
   discovery notification is expected for this Android foreground-service variant.
3. In nRF Connect on the iPhone, start scanning. Find the advertised service
   `7b9e1000-29c4-4a91-8c65-66d9384a1000`. The device may be unnamed: identify it by
   that service UUID, not by a Samsung Bluetooth name or signal strength alone.
4. Pause discovery on the Samsung and do a new scan on the iPhone to check that
   new observations disappear. Scanner lists may retain old entries; a cached row
   is not a fresh observation. Resume the Samsung session to check it reappears.
5. After confirming foreground behavior, keep the iPhone scanner open, lock the
   Samsung, and scan again. Record whether there are new observations after lock,
   including after five minutes. Keep the Samsung session within its 30-minute limit.

Record service UUID, fresh observation times, Samsung locked/unlocked state, and
whether pausing stops new observations. There will be **no introduction** in this
scanner-only test: nRF Connect does not implement our signed encounter protocol.

If the Samsung logs `advertising_started` but the iPhone sees no fresh matching
service, record that outcome and export the Samsung diagnostics. Do not treat a
nearby unnamed device or a cached scan result as a pass.

After this check, use a Mac to install our native iOS app. Then follow the
[full runbook](runbook.md) for authenticated exchanges, shared HTTPS coordination
and both-phones-locked trials. USB success alone does not pass those gates.
