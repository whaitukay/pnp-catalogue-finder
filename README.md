# PnP Catalogue Finder (Expo)

[![React Native CI/CD](https://github.com/whaitukay/pnp-catalogue-finder/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/whaitukay/pnp-catalogue-finder/actions/workflows/ci.yml)
[![Open issues](https://img.shields.io/github/issues/whaitukay/pnp-catalogue-finder)](https://github.com/whaitukay/pnp-catalogue-finder/issues)
[![Bugs](https://img.shields.io/github/issues-search/whaitukay/pnp-catalogue-finder?query=is%3Aopen+label%3Abug&label=bugs)](https://github.com/whaitukay/pnp-catalogue-finder/issues?q=is%3Aissue+is%3Aopen+label%3Abug)
[![Latest release](https://img.shields.io/github/v/release/whaitukay/pnp-catalogue-finder?display_name=tag&sort=semver)](https://github.com/whaitukay/pnp-catalogue-finder/releases)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/whaitukay/pnp-catalogue-finder?utm_source=oss&utm_medium=github&utm_campaign=whaitukay%2Fpnp-catalogue-finder&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)

An Expo (React Native) app that helps extract Pick n Pay online promotion catalogues into a shareable CSV (Android-first; web tooling included).

The app discovers catalogue categories on `pnp.co.za`, pulls the products for each catalogue, caches the raw dump + derived CSV on-device, and lets you share/export those CSVs (email/share sheet).

## What you can do in the app

- Discover currently available online catalogues.
- Sync missing/updated catalogues and skip ones that are unchanged.
- Open previously cached dumps and review/search extracted items.
- Scan a single catalogue from a `Shop now` / `Buy now` URL.
- Share/email a catalogue CSV export.
- Import custom CSV/XLSX collections (base product + optional barcodes) and render scannable barcodes.

## Quick start

### Prerequisites

- Node.js 20+ (CI uses Node 20)
- Android Studio + Android SDK (recommended for `npm run android`)
- Expo Go (optional) or an Expo dev client

### Install

```bash
npm ci
```

#### `xlsx` dependency (pinned)

This project installs `xlsx` from the official SheetJS CDN tarball (`0.20.3`) rather
than an npm semver range because the npm package is unmaintained.

- Security context: older versions have known issues when parsing crafted files:
  - Prototype pollution in `<=0.19.2` (CVE-2023-30533 / GHSA-4r6h-8v6p-xvw6).
  - ReDoS in `<0.20.2` (CVE-2024-22363 / GHSA-5pgg-2g8v-p4x9).
  - References: https://github.com/advisories/GHSA-4r6h-8v6p-xvw6, https://github.com/advisories/GHSA-5pgg-2g8v-p4x9,
    internal context: [WHA-34](https://linear.app/whaitukay/issue/WHA-34/resolve-prototype-pollution-in-sheetjs)
- Install requirement: `npm ci` needs access to `https://cdn.sheetjs.com`.
  - For offline installs / locked-down CI, mirror the tarball internally and switch
    the dependency to your internal URL (or a `file:` reference).

**How to upgrade the pinned version**

1. Update the `xlsx` URL in `package.json`.
2. Run `npm install --package-lock-only` to refresh `package-lock.json` (including
   the `integrity` hash).
3. Run `npm ci` and `npm test`.

If you're using this project long-term, consider periodically reviewing SheetJS CE
releases + GitHub advisories since automated dependency updaters may not track a
non-registry tarball.

### Run

Start the Metro bundler:

```bash
npm start
```

Then either:

- Open the app in Expo Go (scan the QR code), or
- Build and install the dev client on Android (run in a second terminal):

```bash
npm run android
```

## Useful commands

All scripts live in `package.json`:

- `npm start`: start the Expo dev server
- `npm run start:clear`: start the Expo dev server and clear cache
- `npm run android`: build and run the app on Android (requires local Android SDK)
- `npm run android:clear`: start Expo dev server + clear cache and open Android
- `npm run web`: run the web build
- `npm run prebuild:clean`: regenerate native projects from the Expo config (**overwrites `android/` + `ios/`**)
- `npm test`: run unit tests (Vitest)

## Project layout

- `App.tsx`: root state management + tabbed UI wiring
- `src/screens/*`: tab screens (`Catalogues`, `Dumps`, `Imports`, `Settings`)
- `src/services/pnp.ts`: discovery + PnP API scraping/pulling
- `src/services/catalogueStore.ts`: on-device persistence (settings, caches, dumps, CSV exports)
- `src/types.ts`: shared domain types
- `src/utils/*`: UI helpers (pagination/search, directory item building)

## Data storage

All cache/dump/export files are stored under the app's Expo document directory.

The directory prefix is currently `catalogue-helper/` (legacy name kept for compatibility).

- Root: `catalogue-helper/`
- Dumps: `catalogue-helper/dumps/`
- CSV exports: `catalogue-helper/exports/`
- Imports: `catalogue-helper/imports/`
- Imports manifest: `catalogue-helper/cache/imports-manifest.json`

## CI/CD (high-level)

GitHub Actions (`React Native CI/CD`) runs TypeScript checks on PRs/pushes.

On pushes to `dev` and `main`, the workflow can also build Android artifacts and publish them (Firebase App Distribution + EAS Update), depending on available secrets.
