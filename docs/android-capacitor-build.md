# Android app wrapper (Capacitor)

Capacitor wraps the live HTTPS app (`https://www.zunofund.com`) in a native Android shell. Auth, dashboard, deposits, referrals, and P2P all run in the same WebView as the website.

Config: [`capacitor.config.ts`](../capacitor.config.ts)

## Requirements (one-time)

| Tool | Version | Notes |
|------|---------|--------|
| **JDK** | **21** (LTS) | Capacitor 8 requires Java 21. **Do not use JDK 25** (`major version 69` error). JDK 17 fails with `invalid source release: 21`. |
| **Android Studio** | Latest stable | Installs Android SDK, platform tools, and `adb`. |
| **Node** | Project version | For `npm run cap:sync` |

### 1. Java 21

Install [Eclipse Temurin 21](https://adoptium.net/temurin/releases/?version=21) and set:

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"   # your path
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
java -version   # should show 21.x
```

### 2. Android SDK

Install [Android Studio](https://developer.android.com/studio). In **SDK Manager**, install:

- Android SDK Platform 34+ (or whatever `compileSdk` uses in `android/variables.gradle`)
- Android SDK Build-Tools
- Android SDK Platform-Tools

Create `android/local.properties` (gitignored):

```powershell
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
"sdk.dir=$($sdk.Replace('\','\\'))" | Out-File -Encoding ascii android\local.properties
```

Or copy from [`android/local.properties.example`](../android/local.properties.example).

Optional:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
```

### 3. SSL / certificate errors on Windows

If Gradle fails with `PKIX path building failed`, this project sets:

```properties
org.gradle.jvmargs=... -Djavax.net.ssl.trustStoreType=Windows-ROOT
```

in `android/gradle.properties` so Java trusts Windows root certificates (common on corporate networks).

## Build workflow

Sync web assets + Capacitor config into the Android project:

```powershell
npm run cap:sync
```

### Debug APK (install on phone/emulator)

```powershell
npm run android:build:debug
```

Output:

`android/app/build/outputs/apk/debug/app-debug.apk`

Install on a connected device:

```powershell
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Publish on the website

```powershell
npm run android:publish-apk
```

Hosts the APK at `public/downloads/zuno-android.apk`. After deploy:

- Download page: `https://www.zunofund.com/download`
- Direct file: `https://www.zunofund.com/downloads/zuno-android.apk`

### Release AAB (Play Store)

Requires a signing keystore (create once, store passwords safely):

```powershell
npm run android:build:release
```

Output:

`android/app/build/outputs/bundle/release/app-release.aab`

Configure signing in `android/app/build.gradle` before uploading to Play Console.

## Open in Android Studio (optional)

```powershell
npm run cap:open
```

Then **Build → Build Bundle(s) / APK(s) → Build APK(s)** to preview without the command line.

## App identity

- **Name:** Zuno  
- **Package:** `com.zunofund.mobile`  
- **Icons / splash:** generated under `android/app/src/main/res/` from `resources/icon-only.png` and `resources/splash.png`

Regenerate after icon changes:

```powershell
npx capacitor-assets generate --android
npm run cap:sync
```

## Rendering stability (WebView)

- Remote URL loads production CSS (mobile-safe backgrounds, no fixed blur on touch devices).
- `MainActivity` sets solid WebView background, disables overscroll, enables safe browsing.

Test flicker on the **installed APK**, not only Chrome browser — WebView can differ slightly.

## Preview before Play Store

You can fully preview without publishing:

1. Build **debug APK** and install via USB (`adb install`) or copy APK to the device.
2. Or run on the **Android Emulator** from Android Studio.
3. Only upload **AAB** when ready for internal/closed/production tracks in Play Console.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `JAVA_HOME is not set` | Install JDK 17, set `JAVA_HOME`. |
| `Unsupported class file major version 69` | You are on Java 25; switch to Java 21. |
| `invalid source release: 21` | You are on Java 17; upgrade to Java 21. |
| `SDK location not found` | Create `android/local.properties` with `sdk.dir=...`. |
| `PKIX path building failed` | Ensure `Windows-ROOT` is in `gradle.properties`; fix network proxy if needed. |
| App shows blank screen | Confirm `https://www.zunofund.com` is reachable on the device. |
