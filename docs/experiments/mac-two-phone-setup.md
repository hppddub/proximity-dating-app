# Mac setup: first authenticated Samsung–iPhone exchange

This starts from a Mac without development tools. The Samsung already has our
Android app. Goal: both native apps exchange authenticated encounter data, with
screens unlocked first. The earlier nRF Connect observation is separate evidence.

## 1. Install Xcode

1. On the Mac, install **Xcode by Apple** from the Mac App Store.
2. Open it, accept its license and complete the requested components. Install iOS
   platform support when offered. Xcode needs to support the iPhone's actual iOS
   version; update macOS if the App Store requires it.
3. Open Terminal (Spotlight → Terminal) and run:

```sh
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -version
git --version
```

The password is the Mac login password; Terminal does not display password
characters. Expect an Xcode version and a Git version. Xcode can be a large download.

## 2. Install Node.js and download the project

Download the **macOS Installer (.pkg)** for an LTS Node.js version **24 or newer**
from https://nodejs.org/en/download. Finish the installer, then reopen Terminal.

```sh
node --version
npm --version
mkdir -p "$HOME/Developer"
cd "$HOME/Developer"
git clone --branch prototype/feasibility https://github.com/hppddub/proximity-dating-app.git
cd proximity-dating-app
npm ci
```

If this exact checkout already exists, enter it, switch to the prototype branch
and pull instead of cloning it again. Keep subsequent project commands in this
folder. No Android Studio or Homebrew is required for this procedure.

## 3. Install our app on the actual iPhone

1. Connect the friend's unlocked iPhone to the Mac with a USB data cable. Accept
   “Trust this computer” on the iPhone and enter its passcode.
2. From the project Terminal, run:

```sh
open apps/ios/ProximityLab.xcodeproj
```

3. In Xcode → Settings → Accounts, add your Apple Account.
4. Click the blue ProximityLab project in the left sidebar. Under **TARGETS**,
   select ProximityLab → Signing & Capabilities. Enable automatic signing and
   choose your Personal Team/development team.
5. Change Bundle Identifier to a unique value, for example
   `ca.stanleyzhou.proximitylab`. This is a local signing setting; do not add push
   capability for this initial test. A free Personal Team normally supports basic
   on-device development, subject to Apple's provisioning limits.
6. In the device selector at the top of Xcode, choose the **physical iPhone**, not
   a simulator. Enable Developer Mode on the iPhone if Xcode requests it:
   Settings → Privacy & Security → Developer Mode → restart/confirm.
7. Click the triangular Run button. Wait for build/install. If iOS asks to trust
   the development account, use Settings → General → VPN & Device Management,
   trust that developer, then Run again.
8. Confirm that **Proximity Lab** opens on the iPhone. Stop Xcode's debugging
   session using the square Stop button. Reopen the installed app from the iPhone
   home screen. Keep USB connected for now if useful, but the eventual locked test
   must not run under the Xcode debugger.

The app may report APNs unavailable without push provisioning; this test uses
explicitly labeled diagnostic alerts. That message alone does not block BLE or
coordinator communication.

## 4. Start the Mac coordinator

Connect the Mac, Samsung and iPhone to the **same Wi-Fi network**. Use a home/private
network where devices can communicate with one another. In the project Terminal:

```sh
npm run phone:mac
```

The helper downloads checksum-pinned mkcert from its official GitHub release,
prepares a private development CA, installs that CA into the Mac's trust store
(macOS may request an administrator password), creates a certificate for the Mac's
Wi-Fi IP, and opens Finder at the public certificate file. It prints:

- **PHONE URL**, such as `https://192.168.1.23:8787`;
- separate **SAMSUNG INVITE** and **IPHONE INVITE**;
- the public certificate filename **phone-test-ca.cer**.

Leave Terminal open. If macOS asks whether Node may accept incoming connections,
choose Allow. The helper prevents idle system sleep while its process runs. Codes
are single-use and expire in one hour. If setup takes longer, press Ctrl+C and run
`npm run phone:mac` again for fresh codes; the same CA is reused.

This is the real-phone server. Do not use `demo:web` or the Windows USB-only
`phone:test` launcher for this shared Wi-Fi stage.

## 5. Trust the Mac's test certificate on both phones

Transfer **only `phone-test-ca.cer`** to both phones. Do not transfer private-key
files, the `ca` directory or the whole data folder. The certificate lets those
phones trust this Mac's private HTTPS coordinator.

**iPhone:** AirDrop that file from Finder to the iPhone. Install the certificate
profile via the downloaded-profile prompt, or Settings → General → VPN & Device
Management → the downloaded profile → Install. Enter the iPhone passcode if asked.
Then open Settings → General → About → Certificate Trust Settings and enable full
trust for the newly installed mkcert test root. If AirDrop only saves the file,
locate it in Files and open it to begin profile installation.

**Samsung:** transfer the same file using a USB data cable to the Mac. Android
storage does not normally appear in macOS Finder; a USB command-line route is below.

In a **second Terminal window**, use the same project directory:

```sh
cd "$HOME/Developer/proximity-dating-app"
```

If `adb` is already installed, run the final `adb push` command below. Otherwise
install Google's official small platform-tools package (no Android Studio needed):

```sh
mkdir -p data/android-tools
curl -fL https://dl.google.com/android/repository/platform-tools-latest-darwin.zip -o data/android-tools/platform-tools.zip
unzip -oq data/android-tools/platform-tools.zip -d data/android-tools
data/android-tools/platform-tools/adb devices
data/android-tools/platform-tools/adb -d push data/mac-phone-test/phone-test-ca.cer /sdcard/Download/phone-test-ca.cer
```

Unlock the Samsung and accept the new Mac's USB debugging prompt, then repeat the
push command if it initially says unauthorized. If using an existing `adb`, use
`adb -d push data/mac-phone-test/phone-test-ca.cer /sdcard/Download/phone-test-ca.cer`.

On Samsung, open Settings → Security and privacy → More security settings →
Install from device storage → **CA certificate**, select the file in Downloads,
and finish installation. Some One UI versions place this under Encryption &
credentials. Choose the CA certificate category, not a Wi-Fi client certificate.
The installed Android **debug build** is configured to trust user-installed CAs.

Once the certificate is transferred and the iPhone app installed, disconnect both
USB cables. Keep the Mac server running and both phones on the same Wi-Fi.

## 6. Check server reachability before Bluetooth

On the iPhone, open Safari and visit the printed PHONE URL with `/health` appended,
for example `https://192.168.1.23:8787/health`. It must load without a certificate
warning and show JSON containing `"ok":true`.

Do the same in the Samsung's browser. On some Android browsers, browser trust of a
user CA may differ from the debug app's trust. A browser certificate warning alone
is not an app failure: verify that the correct CA was installed, then test the app
below. Do not disable certificate validation or bypass warnings as a substitute.

If the address times out, check same Wi-Fi, server still running, Mac firewall
permission, and the exact IP/port. If the Mac changes Wi-Fi/IP, restart the helper
and use the new PHONE URL; the existing CA trust can remain installed.

## 7. Enroll and start the two native apps

On Samsung, pause any old discovery session before changing its settings.

| Setting | Samsung | iPhone |
| --- | --- | --- |
| Coordinator URL | Printed PHONE URL | Same printed PHONE URL |
| Invite | SAMSUNG INVITE | IPHONE INVITE |
| Enrollment button | Enroll this installation | Enroll installation |
| Bluetooth/notifications/local-network access | Allow requested permissions | Allow requested permissions |
| Radio role | peripheral | Scanner (central) |
| Diagnostic alerts | Polling alerts on | Local alerts on |

An `enrolled` event should appear on each phone. Then tap **Start 30-minute session
+ discovery** on Samsung first, followed by iPhone. Keep both apps open, both screens
unlocked, and phones together on the table. Close nRF Connect for this test.

## 8. First pass/fail check

Wait up to one minute. Look for:

1. Samsung `advertising_started`;
2. iPhone `peer_discovered` / `gatt_connected`;
3. `exchange_complete` on the clients;
4. `proof_accepted` after server verification;
5. an offer after repeated fresh exchanges span the 30-second dwell rule.

The first success is **an authenticated exchange**, not an RSSI number. If that
works, exercise the same mutual readiness, QR scan, both confirmations and synthetic
profile reveal used in the browser. Only then move to a separate both-phones-locked
trial with no USB/debugger. Keep diagnostic alert variants separate from live APNs/
FCM testing; remote push setup is not part of this first run.

If it fails, export both diagnostic logs and report the first missing milestone,
rough wait time, exact phone models/OS versions, and whether either app had an
`action_failed`, `proof_failed` or `reply_failed` event. Leave out invites, keys and
personal identifiers. Do not repeatedly reset everything before preserving the
failure log.
