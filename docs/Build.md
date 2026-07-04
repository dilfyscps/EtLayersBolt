# Build

This project builds an Adobe After Effects CEP extension into `dist/cep` using Vite, TypeScript, Bolt CEP, and `vite-cep-plugin`.

## Build Scripts

The project scripts are defined in `package.json`:

```sh
npm run dev
npm run watch
npm run build
npm run zxp
npm run zip
npm run serve
npm run symlink
npm run delsymlink
```

Script behavior:

- `dev`: runs `vite`.
- `watch`: runs `tsc && vite build --watch true`.
- `build`: runs `rimraf dist/* && tsc -p "tsconfig-build.json" && vite build --watch false`.
- `zxp`: cleans `dist`, type-checks, sets `ZXP_PACKAGE=true`, and builds package output.
- `zip`: cleans `dist`, type-checks, sets `ZIP_PACKAGE=true`, and builds package output.
- `serve`: sets `SERVE_PANEL=true` and runs `vite preview`.
- `symlink`: sets `BOLT_ACTION=symlink` and runs Vite/Bolt action handling.
- `delsymlink`: sets `BOLT_ACTION=delsymlink` and runs Vite/Bolt action handling.

## Standard Build

Run:

```sh
npm run build
```

The build performs three major steps:

1. Removes generated files under `dist`.
2. Type-checks with `tsconfig-build.json`.
3. Builds the CEP panel and ExtendScript host into `dist/cep`.

The generated extension output includes the React panel assets and the ExtendScript bundle at:

```text
dist/cep/jsx/index.js
```

## Production Build Process

Use the production package scripts when preparing distributable artifacts:

```sh
npm run zxp
```

or:

```sh
npm run zip
```

These scripts use the same root type-check and Vite build path as `npm run build`, then set package-specific environment flags consumed by `vite.config.ts` and `vite-cep-plugin`.

Generated package outputs are configured in `vite.config.ts`:

- ZXP output base: `dist/zxp/<extension-id>`
- ZIP output base: `dist/zip/<display-name>_<version>`
- CEP output: `dist/cep`

`cep.config.ts` controls package metadata, including ZXP organization, timestamp authorities, source map behavior, and JSXBIN settings.

## Vite Build Configuration

`vite.config.ts` is the main build configuration.

Important values:

- Root: `src/js`
- CEP output directory: `dist/cep`
- Panel Rollup inputs: derived from `cepConfig.panels`
- Output format: CommonJS
- Browser target: `chrome74`
- Plugins: `@vitejs/plugin-react` and `vite-cep-plugin`
- ExtendScript entry: `src/jsx/index.ts`
- ExtendScript output: `dist/cep/jsx/index.js`

The `chrome74` target is intentional for CEP compatibility. If Vite or dependency updates warn about modern JavaScript output, verify the generated panel still targets the CEP Chromium runtime before changing this value.

## ExtendScript Build Configuration

`vite.es.config.ts` builds the ExtendScript bundle with Rollup and Babel.

It uses:

- `@rollup/plugin-json`
- `@rollup/plugin-node-resolve`
- `@rollup/plugin-babel`
- `jsxPonyfill`
- `jsxInclude`
- `jsxBin`

In production mode, it writes the bundle. In development mode, it watches ExtendScript source and triggers panel refreshes by touching panel HTML files.

The host bundle includes `src/jsx/aeft/etlayers-host.ts` because it is imported by `src/jsx/aeft/aeft.ts`, which is imported by `src/jsx/index.ts`.

## CEP Configuration

`cep.config.ts` defines the extension that After Effects loads:

- `id`: `com.etvrnity.etlayers.bolt`
- `displayName`: `EtLayers Bolt`
- `hosts`: `AEFT`
- `type`: `Panel`
- Main panel path: `./main/index.html`
- Dev port: `3000`
- Serve port: `5000`
- Extension manifest version: `6.0`
- Required runtime version: `9.0`
- Build source map setting
- ZXP signing and timestamp metadata

The exported `version` comes from `package.json`.

## Environment Variables

Build behavior is controlled by environment variables set by npm scripts:

- `NODE_ENV`: controls production detection.
- `DEBUG_REACT=true`: forwards React debug mode to the CEP plugin config.
- `ZXP_PACKAGE=true`: enables ZXP package behavior.
- `ZIP_PACKAGE=true`: enables ZIP package behavior.
- `SERVE_PANEL=true`: enables preview mode.
- `BOLT_ACTION=symlink`: creates the local CEP symlink.
- `BOLT_ACTION=delsymlink`: removes the local CEP symlink.

The application update endpoint is a user preference stored by the panel, not a build-time environment variable.

## Build Artifacts

Generated artifacts:

- `dist/cep`: CEP extension output loaded by After Effects or packaged.
- `dist/cep/jsx/index.js`: bundled ExtendScript host.
- `dist/zxp`: ZXP package output when running `npm run zxp`.
- `dist/zip`: ZIP package output when running `npm run zip`.

Generated directories should not be edited manually. Rebuild from source instead.

## Versioning

The project version is defined in `package.json`.

`cep.config.ts` imports that version and exposes it to the CEP config. `src/shared/shared.ts` also exposes the version for the React UI through shared metadata.

When preparing a release:

1. Update `package.json` version.
2. Keep `package-lock.json` synchronized by using npm.
3. Confirm the UI displays the intended version.
4. Run `npm run build`.
5. Run the selected package command, usually `npm run zxp` or `npm run zip`.

Use semantic versioning where practical:

- Patch versions for bug fixes.
- Minor versions for backward-compatible features.
- Major versions for breaking workflow or compatibility changes.

## Release Process

A practical release checklist:

1. Confirm the release scope and user-visible changes.
2. Update version metadata in `package.json`.
3. Install with npm if dependencies changed.
4. Run `npm run build`.
5. Smoke test the panel in After Effects.
6. Test startup with no active composition and with a representative production project.
7. Run `npm run zxp` or `npm run zip`.
8. Inspect package output under `dist`.
9. Record release notes covering new behavior, fixes, known issues, and compatibility notes.

If a repository host is being used, branch, tag, and pull request steps can be added around this checklist. They are workflow choices, not required by the local build itself.

## Troubleshooting Builds

For build failures and CEP runtime issues, see [Troubleshooting](Troubleshooting.md).

Common quick checks:

- Delete stale generated output by rerunning `npm run build`.
- Recreate the CEP symlink with `npm run delsymlink` and `npm run symlink`.
- Confirm `dist/cep/jsx/index.js` exists after build.
- Confirm `cep.config.ts` still points the main panel to `./main/index.html`.
- Use the root build as the supported verification path instead of isolated no-lib ExtendScript type checks.
