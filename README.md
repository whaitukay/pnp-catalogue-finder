# Catalogue Helper Mobile

This is the Expo app for phase 2 of the Pick n Pay catalogue workflow.

## Status:
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/whaitukay/pnp-catalogue-finder?utm_source=oss&utm_medium=github&utm_campaign=whaitukay%2Fpnp-catalogue-finder&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

## Structure

- `App.tsx`: single-screen app shell with four tabs.
- `src/services/pnp.ts`: catalogue discovery, single-url scan, barcode lookup, and export orchestration.
- `src/services/catalogueStore.ts`: local cache files, dump files, CSV files, and saved settings.

## Features

- Pull all currently discoverable catalogues and skip unchanged ones.
- Open a cached catalogue dump and review the extracted items.
- Scan a single catalogue from a `Shop now` / `Buy now` URL.
- Open the device email composer with the catalogue CSV attached.

## Install and run

```bash
npm install
npm run android:check
npm run emulator
npm run android
npm run android:clear
```

## Notes

- Cache, dump JSON, and CSV files are stored in Expo's document directory on the device.
- The email flow uses `expo-mail-composer` when available, and falls back to file sharing if a mail composer is unavailable.
- `npm install` has already been run in this workspace and a `package-lock.json` was generated.
- Android tool locations are read from `.android-paths.json`, and the Expo scripts are wrapped by `with-android-env.ps1` so they do not depend on your global shell PATH.
- The current Android SDK and JDK have been moved to `E:\AndroidDev`.
