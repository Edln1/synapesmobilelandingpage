# Ava Android preview

`ava-preview.apk` is a signed debug test build of the separate personal Ava app, package `com.synapses.ava.preview`, version `0.1.7-preview`, for Android 8 and newer. It can be installed alongside the existing Synapses app.

The app opens the hosted Ava conversation. It needs internet access and the normal account/service access. This is not an offline model or avatar renderer. It uses the existing email/password sign-in flow; external browser OAuth callbacks are not configured in this preview.

Gradle assembly, APK signature, archive alignment, packaged entry assets and origin-policy checks passed. Device sign-in, keyboard, microphone and a real voice call still need a phone/emulator smoke test. No device installation or live call was performed during this build.

The SHA-256 digest is in `ava-preview.sha256`. Android Studio source is kept separately in the Ava Android project. No private signing key is included in this download directory.

This update uses the same Ava header, smiley icon and menus as the mobile website. The extra Android toolbar has been removed. The signature is unchanged, so this preview updates the earlier Ava preview package.

Version 0.1.2 keeps the original animated voice icon in the Ava header, suppresses automatic chat keyboard focus, adds direct Calls access and a compact menu, corrects duplicate Android insets, and presents the real Ava sign-in form instead of the generic Join/guest landing. Hosted voice capture now serializes startup/recovery and releases stale streams after stop. Real device microphone testing remains necessary.

Version 0.1.3 adds the saved-chat Home page, a single header mic for live speech, a separate opt-in composer speaker for read-aloud replies, and Home-aware Android Back navigation. The live mic stays inside Ava; selecting chats does not autofocus the keyboard.
Version 0.1.4 keeps live speech in the Ava header with the green waveform, improves mobile chat navigation and motion, and adds a confirmed Delete action for individual conversations. The Home shortcut focuses a new message.

Version 0.1.7 centers the original Synapses voice animation in Ava’s header. The waveform breathes green while listening and opens into the same audio-driven purple shape while Ava speaks.
