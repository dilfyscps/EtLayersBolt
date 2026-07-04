# Troubleshooting

This guide covers common EtLayers Bolt development and runtime issues for the current After Effects CEP extension.

## Black or Blank Panel

Symptoms:

- The EtLayers panel opens but stays black or empty.
- The React UI never appears.
- A startup diagnostic panel appears instead of the main UI.

Checks:

1. Run a fresh build:

```sh
npm run build
```

2. Confirm `dist/cep` exists and includes panel assets.
3. Confirm `dist/cep/jsx/index.js` exists.
4. Confirm `cep.config.ts` still points the main panel to `./main/index.html`.
5. Restart After Effects after rebuilding or changing symlinks.
6. If a diagnostic panel appears, read the stage, message, host function, file, evalScript snippet, and raw host result.

Likely causes:

- Stale generated output.
- Missing or failed React entrypoint.
- Missing `#app` element in panel HTML.
- Host script load failure.
- JavaScript incompatible with the CEP Chromium runtime.

## No After Effects Connection

Symptoms:

- Bridge status reports CEP unavailable.
- The panel shows browser preview/mock data.
- Host calls fail with `CEP is not available.`

Checks:

1. Make sure the panel is opened inside After Effects, not only in a browser.
2. Confirm the local CEP symlink exists:

```sh
npm run symlink
```

3. Restart After Effects after symlink changes.
4. Confirm `cep.config.ts` includes `AEFT` in `hosts`.
5. Rebuild if `dist/cep` is stale:

```sh
npm run build
```

Browser preview mode intentionally uses `src/js/main/lib/mockData.ts` when CEP is unavailable.

## evalScript Failures

Symptoms:

- A bridge call times out.
- The UI reports that `CSInterface.evalScript` failed.
- A host call returns an error message.

Checks:

1. Identify the failing host function from the diagnostic output.
2. Confirm the function exists on `EtLayersHost`.
3. Confirm all arguments are serializable and escaped correctly.
4. Confirm the host method returns a JSON string shaped as `{ ok, data, error }`.
5. Check for ExtendScript runtime errors inside the host method.

Common causes:

- A host method throws before calling `respond()`.
- A host method returns `undefined` or a non-JSON string.
- A payload shape changed without updating `src/js/main/types/layers.ts` and `cepBridge.ts`.
- Too many small host calls are being made in a tight loop.

## JSX Host Not Loaded

Symptoms:

- Startup reports `EtLayersHost is not defined`.
- Startup reports `Host JSX file was not found`.
- Startup reports missing required host methods.

Checks:

1. Run:

```sh
npm run build
```

2. Confirm the file exists:

```text
dist/cep/jsx/index.js
```

3. Confirm `src/jsx/index.ts` imports the After Effects module.
4. Confirm `src/jsx/aeft/aeft.ts` imports `./etlayers-host`.
5. Confirm the method is attached to global `EtLayersHost` in `src/jsx/aeft/etlayers-host.ts`.
6. If a new required method was added, add it to both the host and `REQUIRED_HOST_METHODS` in `src/js/main/lib/cepBridge.ts`.

The React entrypoint calls `initBolt()`, which also attempts to load `jsx/index.js` or `jsx/index.jsxbin` when running under CEP. The EtLayers bridge performs its own host verification and load path as part of startup.

## Build Target or ES3 Warning

Symptoms:

- Build logs mention old JavaScript targets or ExtendScript compatibility.
- A dependency emits syntax that may not run in CEP or ExtendScript.

Context:

- The React panel build targets `chrome74` for CEP compatibility.
- The ExtendScript build uses Rollup and Babel through `vite.es.config.ts`.
- ExtendScript is not a modern browser runtime.

Checks:

1. Keep `target: "chrome74"` unless you have confirmed CEP compatibility.
2. Keep modern browser-only APIs out of `src/jsx`.
3. Prefer simple, serializable host code in `etlayers-host.ts`.
4. Run the supported root build:

```sh
npm run build
```

5. Test the panel inside After Effects after dependency updates.

## Narrow Panel Overflow

Symptoms:

- Content spills outside a docked panel.
- Rows or controls are clipped horizontally.
- The whole panel scrolls instead of only the active content region.

Checks:

1. Inspect `src/js/main/etlayers-native.css`.
2. Preserve `min-width: 0` and `min-height: 0` on flex containers.
3. Keep scroll on local regions such as `.etl-scroll-view` and `.etl-list`.
4. Test at 300-400px docked widths.
5. Avoid adding fixed-width controls without responsive behavior.
6. Use existing compact component patterns where possible.

The current UI is designed for full-panel flex layout, dark native styling, local scroll regions, keyboard focus gating, and responsive behavior in narrow After Effects panels.

## Stale dist or Symlink

Symptoms:

- After Effects loads an older UI.
- Host methods do not match the current source.
- Rebuilt code does not appear in the panel.

Fix:

```sh
npm run build
npm run delsymlink
npm run symlink
```

Then restart After Effects.

Checks:

- Confirm `dist/cep` was regenerated.
- Confirm `dist/cep/jsx/index.js` has a fresh timestamp.
- Confirm After Effects is loading the expected extension id, `com.etvrnity.etlayers.bolt`.

## Update Check or Network Failure

Symptoms:

- The help/status area reports that the update check failed.
- The panel cannot reach the configured release endpoint.

Context:

The default update endpoint is stored in preferences:

```text
https://api.github.com/repos/Etvrnity/EtLayers/releases/latest
```

Checks:

1. Confirm the machine has network access.
2. Confirm the endpoint is reachable outside After Effects.
3. Confirm the endpoint returns JSON with `tag_name`, `version`, or equivalent release metadata.
4. Reset settings if the endpoint was edited incorrectly.

Update check failures should not block layer search, project audit, or local host operations.

## Project Opens but No Layers Appear

Symptoms:

- The panel says no active composition.
- Search results are empty.
- Stats show zero layers.

Checks:

1. Open a composition in After Effects and make it active.
2. Press Refresh.
3. Clear the search query.
4. Disable precomp-only assumptions by testing with layers in the active comp.
5. If the project state changed outside the panel, wait for polling or press Refresh.

The host returns an empty snapshot when no active composition is available.

## Project Audit Looks Stale

Symptoms:

- Missing footage or project issue counts do not update immediately.
- Project issue list does not reflect a recent change.

Checks:

1. Press Refresh.
2. Change active composition or project state to update the project fingerprint.
3. Confirm the host method `getProjectAudit` returns the expected groups.

The host caches project audit data by project fingerprint. This keeps repeated reads fast but means project changes must update the fingerprint or trigger a refresh path.

## Batch Rename Fails

Symptoms:

- Batch rename reports no active composition.
- Batch rename reports no layers renamed.
- Regex rename does not produce the expected output.

Checks:

1. Open an active composition.
2. Select layers when applying to selected layers.
3. Confirm the live preview matches the intended operation.
4. Test non-regex search/replace before testing regex.
5. Avoid invalid regular expressions.

The host wraps batch rename in an After Effects undo group and rebuilds its snapshot after the operation.

## Isolated ExtendScript Type Check Warnings

Symptoms:

- `tsc -p src/jsx/aeft/tsconfig.json --noEmit` reports no-lib or Adobe typing issues.

Context:

`src/jsx/aeft/tsconfig.json` uses Adobe no-lib typings. Isolated checks can expose typing-environment issues that do not represent the supported product verification path.

Use:

```sh
npm run build
```

as the supported verification command.

## Debugging Checklist

When a problem is unclear, collect:

- The command that was run.
- Whether the panel was opened in After Effects or a browser.
- The active startup diagnostic stage.
- The failing host function, if any.
- Whether `dist/cep/jsx/index.js` exists.
- Whether `EtLayersHost` is missing or missing only specific methods.
- Whether the issue reproduces after `npm run build` and an After Effects restart.
