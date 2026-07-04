# EtLayers Bolt

EtLayers Bolt is an Adobe After Effects CEP extension built on the Bolt CEP framework. It provides a React-based panel for searching layers, inspecting composition statistics, auditing project items, and running practical layer utilities from inside After Effects.

## Proprietary Notice

This repository is proprietary software and is not open source. Copyright © 2026 Etvrnity. All Rights Reserved. Viewing this source code does not grant any license or permission to use, copy, modify, redistribute, sublicense, reverse engineer, or create derivative works from any part of this project.

This repository documents the current implementation only: EtLayers running as a Bolt CEP extension with React, Vite, TypeScript, Sass-compatible Bolt tooling, ExtendScript, and `vite-cep-plugin`.

## Documentation

- [Architecture](docs/Architecture.md): CEP, React, bridge, and ExtendScript architecture.
- [Development](docs/Development.md): local setup, workflows, debugging, and performance notes.
- [Build](docs/Build.md): build scripts, production output, packaging, and release process.
- [Troubleshooting](docs/Troubleshooting.md): common panel, bridge, build, and After Effects issues.
- [Contributing](CONTRIBUTING.md): contribution workflow and documentation expectations.

## Project Overview

EtLayers runs as a dockable After Effects CEP panel. The panel UI is a React application rendered from `src/js/main/index-react.tsx` into `src/js/main/index.html`. The UI communicates with After Effects through `CSInterface.evalScript`, loads the bundled ExtendScript host from `dist/cep/jsx/index.js`, and calls global `EtLayersHost` methods implemented in `src/jsx/aeft/etlayers-host.ts`.

Current capabilities include:

- Layer search across the active composition, with optional precomp traversal.
- Composition statistics for layer types, visibility, locks, and broken expressions.
- Project audit groups for missing footage, offline proxies, placeholders, test assets, duplicate footage, unused footage, empty comps, and broken expressions.
- Layer operations such as selection, reveal in timeline/project, rename, duplicate, delete, lock, solo, shy, label changes, batch rename, and auto labels.
- Browser preview fallback data through `src/js/main/lib/mockData.ts` when CEP is unavailable.

## Technology Stack

- **Adobe CEP** for the After Effects panel runtime.
- **Bolt CEP** utilities for CSInterface, ExtendScript loading, CEP initialization, link helpers, and packaging integration.
- **React 19** and **React DOM** for the panel UI.
- **Vite 6** for development, panel bundling, and preview serving.
- **TypeScript** for the panel, shared types, and ExtendScript source.
- **ExtendScript** for all After Effects API access.
- **Sass/Bolt build tooling** and native CSS for panel styling. The active EtLayers UI stylesheet is `src/js/main/etlayers-native.css`.
- **vite-cep-plugin** for CEP manifest generation, symlinks, ZXP/ZIP packaging, and ExtendScript build helpers.

Use npm as the primary package manager. `package-lock.json` is present and should be kept in sync with `package.json`.

## Quick Start

Install dependencies:

```sh
npm install
```

Run the Vite development server:

```sh
npm run dev
```

Create the local CEP symlink when you want After Effects to load the extension from this workspace:

```sh
npm run symlink
```

Build the extension:

```sh
npm run build
```

Build artifacts are generated under `dist/cep`. `node_modules` and `dist` are generated directories and should not be edited by hand.

## Main Scripts

The project scripts are defined in `package.json`:

```sh
npm run dev        # Start Vite development server
npm run watch      # Type-check and build in watch mode
npm run build      # Clean dist, type-check, and build dist/cep
npm run zxp        # Build and package a ZXP
npm run zip        # Build and package a ZIP archive
npm run serve      # Preview a built panel
npm run symlink    # Create the local CEP symlink
npm run delsymlink # Remove the local CEP symlink
```

## Folder Structure

```text
.
├── cep.config.ts              # CEP extension metadata and packaging settings
├── vite.config.ts             # Vite panel build and CEP plugin configuration
├── vite.es.config.ts          # ExtendScript Rollup/Babel build configuration
├── tsconfig.json              # React/browser TypeScript configuration
├── tsconfig-build.json        # Root build TypeScript configuration
├── src/
│   ├── js/
│   │   ├── main/              # EtLayers React panel
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   ├── lib/
│   │   │   ├── types/
│   │   │   └── etlayers-native.css
│   │   └── lib/utils/bolt.ts  # Bolt CEP utilities used by the panel
│   ├── jsx/
│   │   ├── index.ts           # ExtendScript namespace binding
│   │   └── aeft/              # After Effects host implementation
│   └── shared/shared.ts       # Shared metadata from config/package
├── docs/
└── dist/cep/                  # Generated build output
```

## Configuration Highlights

`cep.config.ts` defines extension metadata:

- Extension id: `com.etvrnity.etlayers.bolt`
- Display name: `EtLayers Bolt`
- Host: After Effects (`AEFT`)
- Panel main path: `./main/index.html`
- Development port: `3000`
- Preview port: `5000`
- Output and package metadata for `dist/cep`, ZIP, and ZXP builds

`vite.config.ts` sets `src/js` as the Vite root, uses `@vitejs/plugin-react` and `vite-cep-plugin`, derives Rollup inputs from `cep.config.ts`, outputs CommonJS chunks under `dist/cep`, targets `chrome74`, and invokes `extendscriptConfig()` to build `src/jsx/index.ts` to `dist/cep/jsx/index.js`.

`vite.es.config.ts` builds the ExtendScript bundle with Rollup, Babel, and `vite-cep-plugin` helpers including `jsxPonyfill`, `jsxInclude`, and `jsxBin`. In development it touches panel HTML after JSX changes so the panel can refresh.

## Runtime Architecture

The panel has three layers:

1. **React panel**: `src/js/main/App.tsx` owns tab state, preferences, keyboard shortcuts, localStorage persistence under `etlayers:v1`, update checks, focus modality, polling, and UI composition.
2. **CEP bridge**: `src/js/main/lib/cepBridge.ts` wraps Bolt's `csi`, verifies and loads `EtLayersHost`, calls `CSInterface.evalScript`, parses `{ ok, data, error }` JSON responses, and provides browser mock responses when CEP is unavailable.
3. **ExtendScript host**: `src/jsx/aeft/etlayers-host.ts` defines global `EtLayersHost` methods and owns all After Effects API access.

See [Architecture](docs/Architecture.md) for the detailed flow.

## Development Notes

- Keep React UI code in `src/js/main`.
- Keep host API additions in `src/jsx/aeft/etlayers-host.ts`.
- Update shared response types in `src/js/main/types/layers.ts` when the bridge payload changes.
- Keep host calls coarse-grained. CEP `evalScript` has meaningful overhead and should move structured payloads rather than many tiny calls.
- Do not rely on isolated `tsc -p src/jsx/aeft/tsconfig.json --noEmit` as the primary verification path. That config uses Adobe no-lib typings and may report environment-specific typing issues. Use the root build script for project verification.

## Build Output

`npm run build` removes previous generated output, runs TypeScript through `tsconfig-build.json`, and builds the CEP extension into `dist/cep`.

Production package scripts set packaging environment flags:

- `npm run zxp` sets `ZXP_PACKAGE=true`
- `npm run zip` sets `ZIP_PACKAGE=true`

See [Build](docs/Build.md) for production packaging, versioning, and release guidance.

## Roadmap

Potential future improvements include broader project audit coverage, richer diagnostics for host startup failures, more keyboard-first workflows, configurable update channels, additional automated tests around bridge payloads, and continued tuning for very large compositions. These are directional possibilities, not committed release promises.

## License

See [LICENSE.md](LICENSE.md) for the proprietary software license terms.

This repository is not open source. Copyright © 2026 Etvrnity. All Rights Reserved. All source code, assets, documentation, icons, branding, and other project files are protected by copyright. Commercial use is strictly prohibited without written permission from Etvrnity.
