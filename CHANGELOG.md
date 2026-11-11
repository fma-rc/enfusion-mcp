# Changelog

All notable changes to this fork. Format follows [Keep a Changelog](https://keepachangelog.com/),
versions follow [SemVer](https://semver.org/). Fork of
[steffenbk/enfusion-mcp-BK](https://github.com/steffenbk/enfusion-mcp-BK), itself a fork of
[Articulated7/enfusion-mcp](https://github.com/Articulated7/enfusion-mcp).

## [1.1.1] - 2026-11-11

### Fixed
- The `enfusion-mcp` command was missing from 1.1.0: npm 12 dropped the `./`-prefixed `bin` path at
  publish, so `npx -y @fma-rc/enfusion-mcp` had nothing to run.

### Changed
- README install section: npm package link, Claude Code and JSON client configs, Windows and Linux
  paths, how to update.

## [1.1.0] - 2026-11-11

First release on npm, as `@fma-rc/enfusion-mcp`. The unscoped `enfusion-mcp` package is upstream.

### Added
- From upstream enfusion-mcp-BK (merged through v0.12.0 plus 37 later commits):
  - `layout_recipe`: UI layouts from blueprints extracted from real game HUDs, on a rewritten
    layout engine.
  - `menu_create`: a complete custom menu (class, `ChimeraMenuPreset` entry, layout, input-context
    guards).
  - `gamemode_scaffold`: a modded Conflict game mode composed from feature recipes.
  - `wb_read_props`: engine-resolved prefab and config properties through the Workbench.
  - Vehicle engine tuning UI (`npm run tuning-server`).
  - Scenario relay towers, a low-population seeding mode, and prefab component-dependency warnings.

### Changed
- API index re-scraped for **Arma Reforger 1.9** (Tools buildid 26257418): 951 Enfusion + 8,156
  Arma classes.
- The scraper reads the Tools' Doxygen docs either zipped (up to 1.7) or unpacked (1.8 and later).
  The zip-only reader found nothing on 1.8 and silently kept the old index.
- README rewritten for npm installs; finished design and plan documents removed.

### Fixed
- `.pak` reader: entries are read at their absolute offset and decompressed as zlib, and
  unsupported compression gives a clear error.
- `.et`/`.conf` text parser: numeric tuples such as `coords 0 0 0` are no longer truncated, and a
  bare key/value pair before a quoted key no longer repeats a token.
- Workbench handler errors are raised instead of being reported as success, and a handler class
  added after Workbench started gives an explanatory error.
- `ENFUSION_WORKBENCH_PATH` may point at the Tools root or its `Workbench` subdirectory.
- Windows path handling, knowledge-base output size, project reads and building writes hardened.
- The animation integration test skips cleanly when its local game-asset fixture is absent.

## [1.0.0] - 2026-06-05

Not published to npm. Based on enfusion-mcp-BK v0.10.0.

### Added
- **Workbench launcher for Linux / Proton.** The Windows Workbench runs on Linux through `proton run`
  with the Steam compat environment, or through `steam -applaunch`. New `launcher` setting
  (`auto` | `native` | `proton` | `steam`, default `auto`, which picks Proton on Linux), with the
  Proton install, Steam root and Tools prefix detected automatically. New variables:
  `ENFUSION_WB_LAUNCHER`, `ENFUSION_PROTON_PATH`, `ENFUSION_STEAM_ROOT`,
  `ENFUSION_STEAM_COMPAT_DATA_PATH`, `ENFUSION_STEAM_APPID`.
- Opening and switching projects on Linux, and killing the whole Proton launch chain on exit.

### Changed
- API index re-scraped for Arma Reforger 1.7. The scraper matches doc pages by file name, since 1.7
  nests them under `html/` and merges the Enfusion and Arma APIs into one archive.
- The server version is read from `package.json`.

### Fixed
- An explicit `gamePath` from the config file or environment is no longer overwritten by the
  derived default, which sent `asset_search` and `game_read` to the wrong directory.
