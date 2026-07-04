# Development

This guide covers local development for EtLayers Bolt, the current Adobe After Effects CEP extension implementation.

## Prerequisites

- Node.js and npm.
- Adobe After Effects with CEP extension support.
- Dependencies installed with npm:

```sh
npm install
```

Use npm as the primary package manager because `package-lock.json` is present.

## Development Setup

Start the Vite dev server:

```sh
npm run dev
```

Create a local CEP symlink so After Effects can load the extension from this workspace:

```sh
npm run symlink
```

Open After Effects and load the EtLayers panel from the extension menu. The extension metadata comes from `cep.config.ts`:

- Extension id: `com.etvrnity.etlayers.bolt`
- Display name: `EtLayers Bolt`
- Panel display name: `EtLayers`
- Host: `AEFT`
- Panel main path: `./main/index.html`

When you are done with local CEP development, remove the symlink:

```sh
npm run delsymlink
```

## Common Commands

```sh
npm run dev        # Vite development server on port 3000
npm run watch      # TypeScript check, then Vite build in watch mode
npm run build      # Clean dist, type-check, and build dist/cep
npm run serve      # Preview built output on port 5000
npm run symlink    # Register local CEP extension symlink
npm run delsymlink # Remove local CEP extension symlink
```

Package commands are documented in [Build](Build.md).

## Browser Preview Mode

The React panel can run in a browser without CEP. In that mode, `src/js/main/lib/cepBridge.ts` detects that CEP is unavailable and returns fallback data from `src/js/main/lib/mockData.ts`.

Use browser preview for layout and interaction work that does not require real After Effects state. Host-dependent behavior still needs testing inside After Effects.

## Working on React UI

Primary files:

- `src/js/main/index-react.tsx`: React entrypoint and startup error boundary.
- `src/js/main/App.tsx`: application state, tabs, preferences, polling, keyboard shortcuts, update checks, and bridge calls.
- `src/js/main/components`: reusable UI components.
- `src/js/main/lib`: bridge, diagnostics, mock data, and formatting helpers.
- `src/js/main/types/layers.ts`: shared panel-side data contracts.
- `src/js/main/etlayers-native.css`: active UI styling.

Guidelines:

- Keep component APIs typed and small.
- Prefer existing components such as `Button`, `SectionCard`, `StatusPanel`, `LayerList`, and `SettingsPanel`.
- Preserve docked-panel behavior at 300-400px widths.
- Keep scroll regions local with flex containers and `min-height: 0`.
- Keep focus behavior consistent with `etl-keyboard-navigation`.

## Working on ExtendScript

Primary files:

- `src/jsx/index.ts`: app detection and namespace binding.
- `src/jsx/aeft/aeft.ts`: After Effects module entry; imports the EtLayers host and exports Bolt sample helpers.
- `src/jsx/aeft/etlayers-host.ts`: EtLayers After Effects host implementation.

All After Effects API access belongs in `etlayers-host.ts`.

Host methods should:

- Return JSON strings shaped as `{ ok, data, error }`.
- Use the existing `respond()` helper.
- Use undo groups for mutating operations.
- Rebuild snapshots after mutations that affect cached layer state.
- Keep payloads compatible with `src/js/main/types/layers.ts`.
- Avoid relying on modern browser APIs; ExtendScript has an older JavaScript runtime.

## Adding a New Host Capability

1. Define or update TypeScript interfaces in `src/js/main/types/layers.ts`.
2. Add the `EtLayersHost` method in `src/jsx/aeft/etlayers-host.ts`.
3. Return a JSON string through `respond()`.
4. Add a typed wrapper method in `src/js/main/lib/cepBridge.ts`.
5. Add the method to `REQUIRED_HOST_METHODS` if startup should fail when it is missing.
6. Update browser fallback behavior in `mockData.ts` or bridge mock branches if the UI needs preview support.
7. Call the bridge method from React.
8. Verify with `npm run build` and test inside After Effects.

## State Management

EtLayers uses React state and effects rather than a global store.

Persistent state is stored under `etlayers:v1` in localStorage. Current persisted values include preferences, active tab, search history, favorites, and expanded result groups.

Preferences include:

- Auto refresh interval.
- Default include precomps.
- Compact result mode.
- Animations.
- Accent color.
- Search behavior.
- Remember UI state.
- Show bridge status.
- Update endpoint.

Because CEP environments can restrict localStorage, reads and writes are guarded with `try/catch`.

## Styling Workflow

Use `src/js/main/etlayers-native.css` for current UI styling. Keep styles aligned with the existing `etl-*` class system.

Important panel layout patterns:

- `html`, `body`, `#app`, and `.etl-shell` fill the available CEP panel.
- `.etl-app` and `.etl-content` use flex layouts with `min-width: 0` and `min-height: 0`.
- Scrollable regions are explicit, such as `.etl-scroll-view` and `.etl-list`.
- Responsive rules hide nonessential labels in very narrow panels.

## Debugging Guide

### React Startup

`src/js/main/index-react.tsx` records startup stages and renders a fatal startup panel when React cannot mount. Check the diagnostic panel for:

- Startup stage.
- Error message.
- Stack trace.
- Host function.
- Host file.
- EvalScript snippet.
- Raw host result.

### CEP Bridge

`src/js/main/lib/cepBridge.ts` records stages for:

- Loading CSInterface.
- Loading JSX host.
- Host loaded.
- Bridge verified.
- Calling host functions.

If a host method is missing, startup should report which method failed verification.

### ExtendScript Host

Errors inside `EtLayersHost` should be returned through `{ ok: false, data: null, error }`. For mutating operations, confirm undo groups close correctly and snapshots are refreshed after mutation.

### After Effects Runtime

Test host behavior with:

- No project open.
- Project open but no active composition.
- Active composition with zero layers.
- Large compositions.
- Compositions with precomp layers.
- Missing footage or placeholder footage.
- Locked, shy, disabled, solo, parented, and selected layers.

## Supported Verification Path

Run:

```sh
npm run build
```

This is the supported project verification path. It type-checks the panel through the root build config and builds the CEP and ExtendScript outputs.

Direct isolated checks such as:

```sh
tsc -p src/jsx/aeft/tsconfig.json --noEmit
```

can surface no-lib or Adobe typing limitations. Do not treat those isolated errors as product failures unless they also affect the supported root build or runtime behavior.

## Performance Considerations

- Keep host calls coarse-grained. One snapshot call is better than many row-level calls.
- Avoid frequent `evalScript` calls in response to every small UI event.
- Keep search debounce and polling intervals intentional. The default auto refresh interval is stored in preferences and starts at `400`.
- Keep localStorage writes limited to preference/state changes.
- Preserve list virtualization in `LayerList` for large result sets.
- Avoid enabling recursive precomp scans unless the user requested them.
- Cache host work when the project fingerprint has not changed.

## Common Workflows

### Refresh the Layer Index

Use the UI Refresh action or call `etLayersBridge.searchLayers(query, includePrecomps)` from React. The host builds or reuses a snapshot and returns matching layers.

### Add a Setting

Update `EtLayersPreferences` and `defaultPreferences` in `SettingsPanel.tsx`, wire the preference in `App.tsx`, and ensure it is included in persisted state only if it should survive panel reloads.

### Add a Layer Action

Add the action branch in `EtLayersHost.layerAction`, expose it through `LayerContextMenu` or another UI component, and refresh or patch React state after the bridge call returns.

### Update Project Audit Behavior

Update `buildProjectAudit()` in `etlayers-host.ts`, align any new issue types with `ProjectIssueType`, and update `ProjectIssueList` only if rendering needs to change.

### Update Styling

Edit `src/js/main/etlayers-native.css`. Check narrow panel behavior, full-height layout, local scroll regions, and focus behavior after changes.
