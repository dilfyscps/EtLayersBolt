# Architecture

EtLayers Bolt is a single-panel Adobe After Effects CEP extension built with Bolt CEP, React, Vite, TypeScript, and ExtendScript. The React panel owns user interaction; the CEP bridge owns communication; the ExtendScript host owns After Effects API access.

## High-Level Flow

```text
After Effects CEP panel
  └─ src/js/main/index.html
      └─ src/js/main/index-react.tsx
          └─ React App
              └─ etLayersBridge
                  └─ CSInterface.evalScript(...)
                      └─ EtLayersHost methods in ExtendScript
                          └─ After Effects project, comps, layers, footage
```

The React side never calls After Effects APIs directly. It asks `src/js/main/lib/cepBridge.ts` to call a named `EtLayersHost` method. The host returns a JSON string shaped as `{ ok, data, error }`, and the bridge resolves typed data or raises a startup/host diagnostic error.

## Bolt CEP Architecture

Bolt CEP supplies the project structure, CEP utilities, and build integration used by EtLayers.

Key files:

- `cep.config.ts` defines extension metadata, host compatibility, panel metadata, ports, and packaging options.
- `vite.config.ts` configures Vite, React, `vite-cep-plugin`, panel inputs, and output into `dist/cep`.
- `vite.es.config.ts` builds ExtendScript into `dist/cep/jsx/index.js`.
- `src/js/lib/utils/bolt.ts` exposes Bolt utilities such as `csi`, `evalES`, `evalTS`, `initBolt`, and link helpers.

`cep.config.ts` currently defines:

- Extension id: `com.etvrnity.etlayers.bolt`
- Display name: `EtLayers Bolt`
- Host: `AEFT` with version range `[0.0,99.9]`
- Panel type: `Panel`
- Panel main path: `./main/index.html`
- Development port: `3000`
- Preview port: `5000`
- Debug port start: `8860`
- Build output and ZXP/ZIP metadata

The panel is built under `dist/cep`. During development and packaging, `vite-cep-plugin` uses the CEP config to generate the extension structure expected by Adobe CEP.

## Vite Architecture

`vite.config.ts` uses `src/js` as the Vite root. It derives Rollup input entries from `cepConfig.panels`, so the `main` panel resolves to `src/js/main/index.html`.

Important build details:

- Plugins: `@vitejs/plugin-react` and `vite-cep-plugin`.
- Output directory: `dist/cep`.
- Rollup output format: CommonJS.
- Browser target: `chrome74`, matching the older Chromium runtime used by CEP.
- Source maps follow `cep.config.ts` build/package settings.
- `extendscriptConfig()` is invoked from this file to build `src/jsx/index.ts` into `dist/cep/jsx/index.js`.

`vite.es.config.ts` handles ExtendScript bundling with Rollup and Babel. It uses `vite-cep-plugin` helpers:

- `jsxPonyfill()` for ExtendScript compatibility helpers.
- `jsxInclude()` to produce an include-friendly bundle.
- `jsxBin()` when packaging settings request JSXBIN output.

In development, ExtendScript changes trigger a panel refresh by touching each panel HTML file because Vite HMR does not naturally watch outside the panel root.

## React Architecture

The React entrypoint is `src/js/main/index-react.tsx`. It:

- Imports `initBolt()` from `src/js/lib/utils/bolt.ts`.
- Imports `App` from `src/js/main/App.tsx`.
- Imports `src/js/main/etlayers-native.css`.
- Renders into the `#app` element.
- Wraps the app in a startup error boundary so fatal startup problems render diagnostics instead of leaving a black panel.

`src/js/main/App.tsx` is the main UI coordinator. It owns:

- Tabs for `search`, `stats`, `project`, `tools`, `settings`, and `help`.
- LocalStorage persistence under `etlayers:v1`.
- Preferences including auto refresh interval, precomp defaults, compact mode, animations, accent color, search behavior, bridge status, and update endpoint.
- Keyboard shortcuts for search, command palette, result navigation, and selection.
- Startup diagnostics and host initialization state.
- Focus modality management so focus rings appear after Tab navigation only.
- Project polling that compares host project fingerprints and refreshes when state changes.

## State Management

State is local React state managed with hooks. There is no external state library.

Primary state categories:

- `EtLayersSnapshot`: active comp, stats, layer records, project fingerprint, and refresh time.
- Search state: query, history, elapsed time, active result index, precomp inclusion, and search busy state.
- Selection state: active layer, selected layer ids, favorites, and context menu state.
- Project audit state: grouped project issues returned by the host.
- Preferences: persisted user configuration from `SettingsPanel`.
- Startup/update state: startup diagnostics, update check result, and update errors.

Persistent UI state is written to `localStorage` under keys prefixed with `etlayers:v1`. Writes are wrapped in `try/catch` because CEP localStorage can be unavailable in hardened environments.

## Component Organization

React components live under `src/js/main/components`.

Current components include:

- `AboutModal`
- `BatchRenamePanel`
- `Button`
- `CommandPalette`
- `HelpResources`
- `LayerContextMenu`
- `LayerList`
- `ProjectIssueList`
- `SearchInput`
- `SectionCard`
- `SettingsPanel`
- `StatsGrid`
- `StatusPanel`
- `TabNav`

Supporting panel code lives under `src/js/main/lib`:

- `cepBridge.ts`: CEP and host bridge.
- `mockData.ts`: browser preview fallback data.
- `startupDiagnostics.ts`: startup diagnostic helpers.
- `format.ts`: UI formatting helpers.

Shared panel types live under `src/js/main/types`.

## Styling System

The active EtLayers panel stylesheet is `src/js/main/etlayers-native.css`.

The styling system is optimized for After Effects CEP panels:

- Full-panel flex layout rooted at `html`, `body`, `#app`, and `.etl-shell`.
- Local scroll regions to avoid whole-panel overflow.
- Dark native styling that fits Adobe panel conventions.
- Compact controls and typography suitable for docked panels.
- Responsive behavior around 300-400px panel widths.
- Focus-ring gating through the `etl-keyboard-navigation` body class.
- Component class naming based on `etl-*`.

Although the project includes Bolt/Sass build tooling, the current EtLayers UI styles are authored in the native CSS file above.

## CEP Bridge

`src/js/main/lib/cepBridge.ts` is the application bridge between React and After Effects.

Responsibilities:

- Detect whether CEP is available through `window.cep` or `window.__adobe_cep__`.
- Use Bolt's `csi` from `src/js/lib/utils/bolt.ts`.
- Verify that `EtLayersHost` exists and includes required methods.
- Load `jsx/index.js` from the extension path with `$.evalFile()` when needed.
- Wrap `CSInterface.evalScript()` with timeout and structured diagnostics.
- Parse JSON host responses into TypeScript data.
- Reject host errors with startup diagnostic context.
- Provide mock data when the panel runs in a normal browser without CEP.

The required host methods currently include:

- `refresh`
- `searchLayers`
- `getProjectState`
- `getProjectAudit`
- `revealProjectItem`
- `openProjectItem`
- `getStatistics`
- `autoLabels`
- `toggleLayerSelection`
- `layerAction`
- `selectionAction`
- `batchRename`

The bridge also exposes `checkForUpdate()` for network-based update checks and `isCepAvailable()` for UI status.

## After Effects Communication

All communication with After Effects crosses the CEP `evalScript` boundary.

The general pattern is:

1. React calls a method on `etLayersBridge`.
2. The bridge ensures the host script is loaded.
3. The bridge builds an ExtendScript snippet that calls `EtLayersHost[methodName](...)`.
4. `CSInterface.evalScript()` runs the snippet in After Effects.
5. The host method returns a JSON string.
6. The bridge parses the string and returns typed data to React.

Host calls should remain coarse-grained. For example, searching layers returns a full `EtLayersSnapshot` rather than asking the host for each row separately.

## ExtendScript Architecture

`src/jsx/index.ts` is the ExtendScript bundle entry. It imports the After Effects module from `src/jsx/aeft/aeft.ts`, detects the current Adobe application, and attaches the After Effects exports to the shared namespace from `src/shared/shared.ts`.

`src/jsx/aeft/aeft.ts` imports `./etlayers-host`, which defines the actual EtLayers host API. It also exports Bolt sample helpers for type-safe examples. Those sample helpers are development examples, not EtLayers product features.

`src/jsx/aeft/etlayers-host.ts` defines global `EtLayersHost` methods. It owns:

- Active composition detection.
- Layer scanning and recursive precomp traversal.
- Project fingerprinting.
- Snapshot caching.
- Search filtering.
- Composition statistics.
- Project audits.
- Project item reveal/open actions.
- Layer selection and timeline reveal.
- Layer mutation actions.
- Batch rename.
- Auto labels.

Every host response is serialized as:

```json
{
  "ok": true,
  "data": {},
  "error": ""
}
```

On failure, `ok` is `false`, `data` is `null`, and `error` contains a user-readable message.

## Configuration Files

- `package.json`: package metadata, npm scripts, React dependencies, and build tooling.
- `package-lock.json`: npm lockfile and primary dependency lock.
- `cep.config.ts`: CEP extension metadata and packaging settings.
- `vite.config.ts`: Vite, React, CEP plugin, panel build, and ExtendScript build invocation.
- `vite.es.config.ts`: ExtendScript Rollup/Babel build.
- `tsconfig.json`: React/browser TypeScript configuration. It excludes `src/jsx`.
- `tsconfig-build.json`: root build configuration used by `npm run build`.
- `src/jsx/tsconfig.json` and `src/jsx/aeft/tsconfig.json`: ExtendScript/Adobe typing configuration.

## Environment Variables

The build uses environment variables through npm scripts and `vite.config.ts`:

- `NODE_ENV`: determines production mode.
- `DEBUG_REACT=true`: enables React debug behavior in the CEP plugin options.
- `ZXP_PACKAGE=true`: enables ZXP packaging behavior.
- `ZIP_PACKAGE=true`: enables ZIP packaging behavior.
- `SERVE_PANEL=true`: enables preview/serve mode.
- `BOLT_ACTION=symlink`: creates the local CEP symlink.
- `BOLT_ACTION=delsymlink`: removes the local CEP symlink.

Application preferences are not OS environment variables. They are stored in localStorage and include values such as the update endpoint and auto refresh interval.

## Performance Considerations

- `LayerList` uses a virtualized/canvas-style list layout to keep large result sets responsive.
- `evalScript` calls are expensive compared with normal browser function calls; keep host APIs coarse-grained.
- Project polling uses host fingerprints to avoid rebuilding UI state unless After Effects state changes.
- LocalStorage writes are batched through React effects and should remain small.
- Recursive precomp traversal can be costly on very large projects; keep it optional and avoid enabling it silently for all searches.
- Host snapshot caching reduces repeated layer scans when the project fingerprint is unchanged.
