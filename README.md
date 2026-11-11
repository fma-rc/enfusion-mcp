# enfusion-mcp

[![npm](https://img.shields.io/npm/v/@fma-rc/enfusion-mcp)](https://www.npmjs.com/package/@fma-rc/enfusion-mcp)

MCP server for Arma Reforger (Enfusion engine) modding. It gives an AI assistant the script API, the
modding wiki and the base-game files to work from, and generates mod files that follow the engine's
conventions. Targets **Arma Reforger 1.9**, including **Linux with the Tools under Proton**.

## Install

```bash
claude mcp add --scope user enfusion-mcp \
  -e ENFUSION_WORKBENCH_PATH="$HOME/.local/share/Steam/steamapps/common/Arma Reforger Tools" \
  -e ENFUSION_PROJECT_PATH=/path/to/your/mods \
  -- npx -y @fma-rc/enfusion-mcp
```

Any MCP client works the same way: run `npx -y @fma-rc/enfusion-mcp` over stdio. The unscoped
`enfusion-mcp` package on npm is the original upstream project, not this one.

From source:

```bash
git clone https://github.com/fma-rc/enfusion-mcp.git && cd enfusion-mcp
npm install && npm run build
claude mcp add --scope user enfusion-mcp -- node "$PWD/dist/index.js"
```

The server runs `dist/`, so rebuild (`npm run build`) and reload the client after every source change.

## Tools

### Offline (pure Node, no Workbench needed)

| Tool | What it does |
|------|-------------|
| `api_search` | Search the scraped script API (9,107 classes on 1.9: 951 Enfusion + 8,156 Arma), with inherited members and `format: 'tree'` for an inheritance view |
| `component_search` | Search ScriptComponent descendants by category and event handler |
| `wiki_search` / `wiki_read` | Search and read the bundled wiki corpus (274 pages) |
| `wb_knowledge` | Search the bundled modding knowledge base (offline despite the `wb_` prefix) |
| `game_browse` / `game_read` | Browse and read base-game files, loose or inside `.pak` |
| `asset_search` | Find base-game assets by name across loose files and `.pak` |
| `game_duplicate` | Copy a base-game prefab or config into a mod, resolving its ancestor chain |
| `project` | `browse` / `read` / `write` files in a mod project |
| `mod` | `create` (scaffold an addon), `validate` (structure, gproj, scripts, prefabs, configs, references, naming), `build` (Workbench CLI) |
| `prefab` | `create` a prefab from a template, or `inspect` its merged inheritance chain |
| `script_create` | Generate a `.c` file (component, gamemode, action, entity, manager, modded, basic) |
| `layout_create` | Generate a `.layout` (hud, menu, dialog, list, custom) |
| `layout_recipe` | Generate a `.layout` from a blueprint taken from real game HUDs (status, timer, progress, info panel, ...) |
| `menu_create` | Scaffold a complete custom menu: class, `ChimeraMenuPreset` entry, layout with footer hints, input-context guards pre-wired |
| `gamemode_scaffold` | Scaffold a modded Conflict game mode from feature recipes (battle prep, seeding, scaled respawn, save loading, ambient AI, ...) |
| `config_create` | Generate factions, missions, entity catalogs, editor placeables |
| `scenario_create` / `scenario_create_conflict` | Generate scenario files (Conflict: header, world stub, layers) |
| `building_setup` | Set up a destructible building from a Blender export manifest |
| `animation_graph` | Author vehicle `.agr`/`.ast` animation graph scaffolds |
| `server_config` | Generate a dedicated server config |
| `workshop_info` | Read Workshop metadata from a `.gproj` |

### Live Workbench (`wb_*`)

`wb_launch` `wb_connect` `wb_diagnose` `wb_cleanup` `wb_state` `wb_play` `wb_stop` `wb_save`
`wb_undo_redo` `wb_open_resource` `wb_reload` `wb_execute_action` `wb_read_props` `wb_entity_create`
`wb_entity_delete` `wb_entity_duplicate` `wb_entity_list` `wb_entity_inspect` `wb_entity_modify`
`wb_entity_select` `wb_component` `wb_terrain` `wb_layers` `wb_resources` `wb_prefabs`
`wb_clipboard` `wb_script_editor` `wb_localization` `wb_projects` `wb_validate`

They talk to the Workbench NET API (TCP `127.0.0.1:5775`) through handler scripts in
`mod/Scripts/WorkbenchGame/EnfusionMCP/`, which must compile inside the open project's WorkbenchGame
module. **Experimental**: this bridge has not been made to work reliably under Proton. For compiling
and publishing, driving the Workbench CLI directly (`-validate`, `-packAddon`, `-publishAddon`) is the
dependable path. Linux launch details: [docs/LINUX_PROTON.md](docs/LINUX_PROTON.md).

### MCP resources

`enfusion://class/{className}`, `enfusion://pattern/{patternName}`, `enfusion://group/{groupName}`.

## Configuration

All optional. Environment variables beat `~/.enfusion-mcp/config.json` (see
`enfusion-mcp.config.example.json`).

| Variable | Meaning | Default |
|----------|---------|---------|
| `ENFUSION_WORKBENCH_PATH` | Arma Reforger Tools install | Windows Steam path |
| `ENFUSION_GAME_PATH` | Game (or dedicated server) install read by `game_*`/`asset_search` | sibling of the Tools path |
| `ENFUSION_PROJECT_PATH` | Default mod directory | `~/Documents/My Games/ArmaReforgerWorkbench/addons` |
| `ENFUSION_EXTRACTED_PATH` | Directory of extracted base-game files, read before the `.pak` | unset |
| `ENFUSION_DEFAULT_MOD` | Mod name used when a tool call names none | unset |
| `ENFUSION_MCP_DATA_DIR` | Where the API index and wiki corpus live | `data/` in the package |
| `ENFUSION_WORKBENCH_HOST` / `_PORT` | NET API endpoint | `127.0.0.1` / `5775` |
| `ENFUSION_WB_LAUNCHER` and friends | Linux launch strategy | see `docs/LINUX_PROTON.md` |

## Refreshing the API index after a game update

```bash
npm run scrape -- --workbench-path "$HOME/.local/share/Steam/steamapps/common/Arma Reforger Tools"
npm run build
```

It reads the Doxygen docs the Tools ship under `Workbench/docs/`, zipped (up to 1.7) or unpacked
(1.8 and later). Check the closing `Scrape complete:` counts: a scrape that finds no docs warns and
leaves the old index in place. Last scraped: Tools buildid 26257418 (1.9), 2026-11-10.

## Development

```bash
npm test   # 627 tests (12 skip without a local Workbench animation fixture)
npm run tuning-server   # local vehicle engine tuning UI
```

Requires Node 20+. Issues and pull requests: <https://github.com/fma-rc/enfusion-mcp>.

## Upstream and licence

Fork of [steffenbk/enfusion-mcp-BK](https://github.com/steffenbk/enfusion-mcp-BK), itself a fork of
[Articulated7/enfusion-mcp](https://github.com/Articulated7/enfusion-mcp). MIT, same as upstream; the
original copyright notice is kept in `LICENSE`.
