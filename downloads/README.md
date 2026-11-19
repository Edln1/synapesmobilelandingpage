# Ava Android preview

`ava-preview.apk` is a signed debug test build of the separate personal Ava app, package `com.synapses.ava.preview`, version `0.1.0-preview`, for Android 8 and newer. It can be installed alongside the existing Synapses app.

The app opens the hosted Ava conversation. It needs internet access and the normal account/service access. This is not an offline model or avatar renderer. It uses the existing email/password sign-in flow; external browser OAuth callbacks are not configured in this preview.

Gradle assembly, APK signature, archive alignment, packaged entry assets and origin-policy checks passed. Device sign-in, keyboard, microphone and a real voice call still need a phone/emulator smoke test. No device installation or live call was performed during this build.

The SHA-256 digest is in `ava-preview.sha256`. Android Studio source is kept separately in the Ava Android project. No private signing key is included in this download directory.
