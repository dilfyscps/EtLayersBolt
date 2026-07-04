# Contributing to EtLayers Bolt

Thanks for helping improve EtLayers. This project is an Adobe After Effects extension built on Bolt CEP, so changes usually cross a browser panel boundary and an ExtendScript host boundary. Keep contributions focused on the current Bolt CEP implementation.

## Project Scope

Document and modify only the current project:

- React panel source in `src/js/main`.
- Bolt CEP utilities in `src/js/lib/utils/bolt.ts`.
- ExtendScript source in `src/jsx`.
- Build and packaging configuration in `cep.config.ts`, `vite.config.ts`, and `vite.es.config.ts`.

Do not add documentation or code paths for project structures that are not part of the current Bolt CEP extension.

## Setup

Use npm because `package-lock.json` is present:

```sh
npm install
```

For local panel development:

```sh
npm run dev
```

For After Effects integration, create the CEP symlink:

```sh
npm run symlink
```

Remove it when needed:

```sh
npm run delsymlink
```

## Verification

Before submitting a change, run the supported project build:

```sh
npm run build
```

This command cleans `dist`, type-checks through `tsconfig-build.json`, builds the React panel, and builds the ExtendScript bundle into `dist/cep/jsx/index.js`.

Avoid treating isolated After Effects type checks as the primary signal. For example, `tsc -p src/jsx/aeft/tsconfig.json --noEmit` can expose no-lib or Adobe typing limitations that are not the supported product verification path.

## Development Guidelines

- Keep UI state in React unless it must persist in After Effects.
- Persist panel preferences through the existing localStorage namespace `etlayers:v1`.
- Keep After Effects API access inside `src/jsx/aeft/etlayers-host.ts`.
- Return host results as JSON strings shaped like `{ ok, data, error }`.
- Keep bridge calls coarse-grained. Prefer one structured host call over many small `evalScript` calls.
- Update `src/js/main/types/layers.ts` whenever a bridge payload changes.
- Preserve browser preview behavior by updating `src/js/main/lib/mockData.ts` when new UI flows need representative data.
- Keep styling in `src/js/main/etlayers-native.css` and use existing `etl-*` class patterns.
- Design for docked After Effects panels, especially 300-400px widths.

## React Changes

`src/js/main/App.tsx` coordinates tabs, preferences, shortcuts, startup diagnostics, update checks, polling, and bridge calls. Reusable UI belongs in `src/js/main/components`.

When adding UI:

- Prefer small, typed components.
- Use existing `Button`, `SectionCard`, status, list, modal, and form patterns.
- Keep scroll areas local to the relevant content region.
- Preserve focus-ring behavior so focus outlines appear after keyboard navigation rather than every mouse click.

## ExtendScript Changes

`src/jsx/aeft/etlayers-host.ts` owns all After Effects API calls. Host methods should:

- Guard Adobe API access with safe calls where host state may be absent.
- Use undo groups for mutating operations.
- Return a JSON string through the existing `respond()` helper.
- Keep payloads serializable and aligned with TypeScript interfaces in the panel.
- Rebuild or invalidate cached snapshots when project state changes.

`src/jsx/aeft/aeft.ts` imports the EtLayers host and still exports Bolt sample helpers for type-safe examples. Do not present sample helpers as EtLayers product features.

## Bridge Changes

`src/js/main/lib/cepBridge.ts` loads and verifies `EtLayersHost`, wraps `CSInterface.evalScript`, parses host responses, reports startup diagnostics, and provides mock browser behavior when CEP is unavailable.

When adding a host method:

1. Add the method to `EtLayersHost` in `src/jsx/aeft/etlayers-host.ts`.
2. Add the method name to `REQUIRED_HOST_METHODS` if startup should require it.
3. Add a typed bridge method in `cepBridge.ts`.
4. Update types in `src/js/main/types/layers.ts`.
5. Add or update mock behavior if the UI needs browser preview support.

## Documentation Changes

Keep documentation practical and tied to the current codebase. If implementation changes affect setup, build output, bridge contracts, troubleshooting, release steps, or folder structure, update the relevant docs in the same change.

The primary documentation files are:

- `README.md`
- `docs/Architecture.md`
- `docs/Development.md`
- `docs/Build.md`
- `docs/Troubleshooting.md`

## Optional Repository Workflow

If you are working from a repository clone, use normal branch and pull request practices for review. This project should not require contributors to run git commands for local development, and documentation should frame git usage as optional unless a hosting workflow specifically requires it.

## Release Contributions

Release-facing changes should include:

- A version update in `package.json` when appropriate.
- Confirmation that `cep.config.ts` reads the intended version through `package.json`.
- A successful `npm run build`.
- A package build through `npm run zxp` or `npm run zip` when preparing distributable artifacts.
- Notes for user-visible behavior changes.
