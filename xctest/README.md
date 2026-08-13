# xctest — native iOS UI tests (XCUITest)

A self-contained, minimal **native** iOS test template. The test code compiles into an
XCUITest bundle and **runs on the device** (via `testmanagerd`), driven by
`xcodebuild test-without-building` on a Mac. It is *not* driven remotely over WebDriver.

> **Why not run it in your own Xcode against a remote device?** On iOS 17+ the device's
> developer-service tunnel (RemoteXPC/CoreDevice) is root-created, cryptographically bound
> to the physically-paired host, and can't be relayed to another machine — so a remote
> device cannot appear in your local Xcode. The runner therefore executes `xcodebuild` on
> the Mac that physically holds the device (where the tunnel is local and works). You build
> locally and upload the compiled bundle; the tests run on the device.

## Layout

```
project.yml                        xcodegen spec (run `xcodegen generate`)
Sources/App/SampleApp.swift        trivial SwiftUI app under test (Text "Test")
UITests/SampleAppUITests.swift     standard XCUITest suite (runs on device)
```

## Build (on your Mac — source never leaves it)

```bash
brew install xcodegen              # once
xcodegen generate                  # → SampleApp.xcodeproj
xcodebuild build-for-testing \
  -project SampleApp.xcodeproj -scheme SampleApp \
  -destination 'generic/platform=iOS' \
  -derivedDataPath build
# → build/Build/Products/  contains SampleApp.app, SampleAppUITests-Runner.app,
#   and a *.xctestrun  — this is the compiled bundle you upload.
```

Requires Xcode. Only the compiled products are uploaded; the tests execute on the device.

## Known limitation on CoreDevice-held hosts

`xcodebuild test-without-building` installs the test runner through **CoreDevice**, and on
some iOS 17+/18+ pairings that host does not advertise the install capability:

```
ERROR: The capability "Install Application" is not supported by this device.
       (com.apple.dt.CoreDeviceError 1001, com.apple.coredevice.feature.installapp)
```

This is **not** a signing problem and **not** a device restriction. On a fleet where this
was hit, the same bundle installed cleanly over the classic `installation_proxy` service
(`ideviceinstaller install SampleApp.app` → `InstallComplete`), and the device advertised
`uninstallapp`, `launchapplication` and `installroot` while withholding only `installapp`.
Pre-installing both the app and the `-Runner` app does not help: `xcodebuild` re-attempts
its own CoreDevice install regardless and fails before any test executes.

If you hit this, the bundle is fine — the gap is between `xcodebuild` and that host's
CoreDevice. The same devices are driven successfully by Appium using the preinstalled-WDA
path (`USE_PREINSTALLED_WDA=true`), which avoids `xcodebuild` entirely.

## Run on the grid's native runner

Zip the built products (the `.app` bundles + the `.xctestrun`), then submit through the same
proxy as WebDriver sessions (`{{GRID_URL}}`, port 5555), `/t/<token>` auth. The bundle must
be **signed for the target device's UDID** (enroll our device in your provisioning profile —
the runner does *not* re-sign):

```bash
cd build/Build/Products
# Zip the whole Products tree. `*.app` does NOT glob here: xcodebuild puts the
# .app bundles in a Debug-iphoneos/ subdirectory while the .xctestrun sits at the
# top, so a `*.app *.xctestrun` pattern matches only the .xctestrun. The runner
# searches the bundle recursively, so keeping the directory structure is correct.
zip -r ~/ios-bundle.zip . -x '*.dSYM/*'

curl -X POST "{{GRID_URL}}/t/{{AUTH_TOKEN}}/native/runs?platform=ios&devices=<udid>" \
  --data-binary @~/ios-bundle.zip -H "Content-Type: application/zip"
# → { "runId": "...", "status": "running" }

curl "{{GRID_URL}}/t/{{AUTH_TOKEN}}/native/runs/<runId>"   # status + result (.xcresult on host)
```

The runner runs `xcodebuild test-without-building -xctestrun <file> -destination id=<udid>`
on the Mac holding that device, records pass/fail, then uninstalls the app + runner and releases.
