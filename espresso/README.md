# espresso — native Android instrumented tests (Espresso)

A self-contained, minimal **native** Android test template. Unlike the WebDriver/Appium
templates in this repo, the test code here is compiled into an instrumentation APK and
**runs on the device itself** (via `AndroidJUnitRunner`) — it is *not* driven remotely
over WebDriver. You build the two APKs locally and submit them to the grid's native
runner, which reserves a device, runs the suite on-device (sharded across a device pool),
and returns the report.

## Layout

```
app/src/main/…                     trivial app under test (one EditText showing "Test")
app/src/androidTest/…/MainActivityTest.kt   standard Espresso tests (run on device)
Marathonfile                       runner config (device pool → sharding + retries)
```

## Build (on your machine — source never leaves it)

```bash
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest
# → app/build/outputs/apk/debug/app-debug.apk
# → app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
```

Requires the Android SDK + JDK 17. Nothing else runs on the grid host — only these two
compiled APKs are uploaded, and the tests execute on the reserved device.

## Run on the grid's native runner

Submit the compiled bundle through the same proxy you use for WebDriver sessions
(`{{GRID_URL}}`, port 5555), authenticated with the `/t/<token>` path prefix:

The endpoint takes the two APKs as a **flat zip sent as the raw body**, with the
parameters in the **query string** — not as multipart form fields.

```bash
# 1. Zip the two APKs (flat — no directory entries)
zip -j bundle.zip \
  app/build/outputs/apk/debug/app-debug.apk \
  app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk

# 2. Submit. `devices` is REQUIRED — comma-separated adb serials.
curl -X POST "{{GRID_URL}}/t/{{AUTH_TOKEN}}/native/runs?platform=android&devices=<serial[,serial]>" \
  --data-binary @bundle.zip \
  -H "Content-Type: application/zip"
# → 202 { "runId": "nr-…", "status": "running" }

# 3. Poll until status leaves "running"
curl "{{GRID_URL}}/t/{{AUTH_TOKEN}}/native/runs/nr-…"
# → { "runId", "status", "devices", "result": { "passed", "failed", "ignored", "reportDir", "durationMs" } }
```

### Bundles over ~100 MB, or anything going through Cloudflare

The single-request submit above is fine on a LAN. Through Cloudflare it is not: the free
plan rejects a request body over 100 MB, and a real app bundle exceeds that. Push the
bundle in chunks instead, then start the run against the assembled result.

Send the token as a **header** for this flow, not as a `/t/<token>` path prefix. Both
work, but a grid JWT is ~500 characters: the path form turns a 57-character upload URL
into 561, a chunked upload makes one request per chunk, and the token ends up in every
access-log line. The header costs the same on the wire and keeps the credential out of
the URL.

```bash
AUTH="Authorization: Bearer {{AUTH_TOKEN}}"

split -b 45m bundle.zip chunks/part.          # any size <= 50 MB
N=$(ls chunks | wc -l)

UP=$(curl -s -X POST "{{GRID_URL}}/native/uploads?name=bundle.zip&chunks=$N" -H "$AUTH" \
     | jq -r .uploadId)

i=0; for f in chunks/part.*; do
  curl -s -X PUT "{{GRID_URL}}/native/uploads/$UP/$i" -H "$AUTH" --data-binary @"$f" > /dev/null
  i=$((i+1))
done

curl -s -X POST "{{GRID_URL}}/native/uploads/$UP/complete" -H "$AUTH"

curl -X POST "{{GRID_URL}}/native/runs?platform=android&devices=<serial>&bundleId=$UP" -H "$AUTH"
```

Chunks are sent as **raw bytes** — do not base64 them. Base64 inflates the payload ~33%,
so a 50 MB chunk becomes a ~67 MB body and gives back the headroom the cap exists to
protect. The per-chunk ceiling is returned as `chunkLimitBytes` when you begin the upload
(50 MB by default); a larger chunk is refused with `413`.

Get the serials from `adb devices`, or from the grid so you only target devices it
actually has:

```bash
curl -s {{GRID_URL}}/status \
  | jq -r '.value.nodes[].slots[].stereotype
           | select(.platformName == "ANDROID") | ."appium:udid"'
```

| Status | Meaning |
|---|---|
| `running` | in progress |
| `passed` | exit 0, zero failures |
| `failed` | the suite ran and at least one test failed |
| `error` | nothing ran — no device match, install or signing failure; check `reportDir` |

Errors on submit: `400` bad params or bundle · `401` unauthorized · `409` a target device is
mid WebDriver-session · `404` the runner is disabled on that grid
(`NATIVE_RUNNER_ENABLED=true` is required host-side).

The runner reserves the device(s), installs both APKs, runs the suite on-device via
Marathon (sharding + flaky-retries), collects artifacts, then uninstalls + clears state
and releases the device.

## Run locally against your own devices (optional)

With Marathon installed and a device on `adb`:

```bash
marathon                       # uses ./Marathonfile
```

Restrict to specific devices by adding `includeSerialRegexes: [ "^<serial>$" ]` to the
`Marathonfile` (the runner injects this automatically for the reserved device).
