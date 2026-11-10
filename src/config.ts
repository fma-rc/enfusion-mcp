import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { logger } from "./utils/logger.js";

export interface Config {
  /** Path to "Arma Reforger Tools" installation */
  workbenchPath: string;
  /** Default project directory for project_browse */
  projectPath: string;
  /** Path to base game installation (auto-derived from workbenchPath) */
  gamePath: string;
  /** Optional path to a pre-extracted game data library (fully flattened prefabs).
   *  When set, game_duplicate checks here first before falling back to pak loose files.
   *  Set via ENFUSION_EXTRACTED_PATH env var. */
  extractedPath?: string;
  /** Directory containing scraped data index */
  dataDir: string;
  /** Directory containing mod pattern definitions */
  patternsDir: string;
  /** Workbench NET API host (default 127.0.0.1) */
  workbenchHost: string;
  /** Workbench NET API port (default 5775) */
  workbenchPort: number;
  /** Default addon folder name used when modName is not specified in tool calls.
   *  Automatically set at runtime when wb_launch opens a .gproj file.
   *  Can also be set via ENFUSION_DEFAULT_MOD env var as a static fallback. */
  defaultMod?: string;

  /** How to launch the Workbench executable.
   *  - "auto" (default): Linux → "proton", everything else → "native"
   *  - "native": spawn the .exe directly (Windows / a pre-wrapped exe)
   *  - "proton": run the Windows .exe via Proton (Linux)
   *  - "steam": launch via `steam -applaunch <appid>` (Steam applies its runtime)
   *  Set via ENFUSION_WB_LAUNCHER. */
  launcher: "auto" | "native" | "proton" | "steam";
  /** Path to a Proton `proton` run script (e.g. ".../Proton - Experimental/proton").
   *  Auto-detected from the Steam install when unset. Set via ENFUSION_PROTON_PATH. */
  protonPath?: string;
  /** Steam install root (e.g. ~/.local/share/Steam). Used for STEAM_COMPAT_CLIENT_INSTALL_PATH
   *  and to auto-derive the Proton path + compatdata prefix. Set via ENFUSION_STEAM_ROOT. */
  steamRoot?: string;
  /** Steam compatdata prefix for the Tools appid (holds the Wine prefix).
   *  Auto-derived as {steamRoot}/steamapps/compatdata/{steamAppId} when unset.
   *  Set via ENFUSION_STEAM_COMPAT_DATA_PATH. */
  steamCompatDataPath?: string;
  /** Steam appid for "Arma Reforger Tools" (default 1874910). Set via ENFUSION_STEAM_APPID. */
  steamAppId: string;
}

const DEFAULT_WORKBENCH_PATH =
  "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Arma Reforger Tools";

const DEFAULTS: Config = {
  workbenchPath: DEFAULT_WORKBENCH_PATH,
  projectPath: join(homedir(), "Documents", "My Games", "ArmaReforgerWorkbench", "addons"),
  gamePath: resolve(DEFAULT_WORKBENCH_PATH, "..", "Arma Reforger"),
  dataDir: resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "data"
  ),
  patternsDir: resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "data",
    "patterns"
  ),
  workbenchHost: "127.0.0.1",
  workbenchPort: 5775,
  launcher: "auto",
  steamAppId: "1874910",
};

function loadJsonFile(path: string): Partial<Config> {
  try {
    if (!existsSync(path)) return {};
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as Partial<Config>;
  } catch (e) {
    // Distinguish read errors from parse errors so users can fix malformed JSON
    const detail = e instanceof SyntaxError
      ? `invalid JSON: ${e.message}`
      : String(e);
    logger.warn(`Failed to load config from ${path}: ${detail}`);
  }
  return {};
}

export function loadConfig(): Config {
  // 1. Start with defaults
  const config = { ...DEFAULTS };

  // 2. Package-local config file
  const localConfigPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "enfusion-mcp.config.json"
  );
  Object.assign(config, loadJsonFile(localConfigPath));

  // 3. User home config
  const homeConfigPath = resolve(homedir(), ".enfusion-mcp", "config.json");
  Object.assign(config, loadJsonFile(homeConfigPath));

  // 4. Environment variables override everything
  if (process.env.ENFUSION_WORKBENCH_PATH) {
    config.workbenchPath = process.env.ENFUSION_WORKBENCH_PATH;
  }
  if (process.env.ENFUSION_PROJECT_PATH) {
    config.projectPath = process.env.ENFUSION_PROJECT_PATH;
  }
  if (process.env.ENFUSION_GAME_PATH) {
    config.gamePath = process.env.ENFUSION_GAME_PATH;
  }
  if (process.env.ENFUSION_EXTRACTED_PATH) {
    config.extractedPath = process.env.ENFUSION_EXTRACTED_PATH;
  }
  if (process.env.ENFUSION_MCP_DATA_DIR) {
    config.dataDir = process.env.ENFUSION_MCP_DATA_DIR;
    // patternsDir is always <dataDir>/patterns unless explicitly set in a config file
    config.patternsDir = join(process.env.ENFUSION_MCP_DATA_DIR, "patterns");
  }
  if (process.env.ENFUSION_WORKBENCH_HOST) {
    config.workbenchHost = process.env.ENFUSION_WORKBENCH_HOST;
  }
  if (process.env.ENFUSION_WORKBENCH_PORT) {
    const port = parseInt(process.env.ENFUSION_WORKBENCH_PORT, 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      config.workbenchPort = port;
    }
  }
  if (process.env.ENFUSION_DEFAULT_MOD) {
    config.defaultMod = process.env.ENFUSION_DEFAULT_MOD;
  }
  if (process.env.ENFUSION_WB_LAUNCHER) {
    const v = process.env.ENFUSION_WB_LAUNCHER.toLowerCase();
    if (v === "auto" || v === "native" || v === "proton" || v === "steam") {
      config.launcher = v;
    } else {
      logger.warn(`Ignoring invalid ENFUSION_WB_LAUNCHER="${process.env.ENFUSION_WB_LAUNCHER}" (use auto|native|proton|steam)`);
    }
  }
  if (process.env.ENFUSION_PROTON_PATH) {
    config.protonPath = process.env.ENFUSION_PROTON_PATH;
  }
  if (process.env.ENFUSION_STEAM_ROOT) {
    config.steamRoot = process.env.ENFUSION_STEAM_ROOT;
  }
  if (process.env.ENFUSION_STEAM_COMPAT_DATA_PATH) {
    config.steamCompatDataPath = process.env.ENFUSION_STEAM_COMPAT_DATA_PATH;
  }
  if (process.env.ENFUSION_STEAM_APPID) {
    config.steamAppId = process.env.ENFUSION_STEAM_APPID;
  }

  // Auto-derive gamePath from workbenchPath if not explicitly set.
  //
  // ENFUSION_WORKBENCH_PATH is accepted pointing either at the tools ROOT
  // ("...\Arma Reforger Tools") or at its Workbench SUBDIRECTORY
  // ("...\Arma Reforger Tools\Workbench") — findWorkbenchExe() deliberately
  // supports both. A single fixed "../Arma Reforger" only works for the first:
  // given the subdirectory form it resolves to
  // "...\Arma Reforger Tools\Arma Reforger", which does not exist, and every
  // base-game tool (asset_search, game_read, game_browse, game_duplicate) then
  // silently searched a missing directory instead of reporting a bad path.
  //
  // So try both shapes and take the one that is actually on disk. If neither is,
  // keep the one-level guess and warn — that keeps the previous behaviour for
  // anyone relying on it while making the misconfiguration visible.
  if (!process.env.ENFUSION_GAME_PATH && config.workbenchPath !== DEFAULT_WORKBENCH_PATH) {
    const candidates = [
      resolve(config.workbenchPath, "..", "Arma Reforger"),
      resolve(config.workbenchPath, "..", "..", "Arma Reforger"),
    ];
    const resolved = candidates.find((p) => existsSync(p));
    if (resolved) {
      config.gamePath = resolved;
    } else {
      config.gamePath = candidates[0];
      logger.warn(
        `Could not locate the Arma Reforger game directory from ENFUSION_WORKBENCH_PATH ` +
          `("${config.workbenchPath}"). Tried: ${candidates.join(" and ")}. ` +
          `Base game tools (asset_search, game_read, game_browse) will not find anything — ` +
          `set ENFUSION_GAME_PATH explicitly.`
      );
    }
  }

  // Auto-derive extractedPath from the conventional location beside the addons
  // folder. Without it every inherited value resolves to "unresolved", and
  // relying on the caller to export ENFUSION_EXTRACTED_PATH means one plain
  // `npm run tuning-server` silently degrades the whole tool.
  if (!config.extractedPath) {
    const conventional = resolve(config.projectPath, "..", "extracted");
    if (existsSync(conventional)) {
      config.extractedPath = conventional;
    }
  }

  logger.debug("Config loaded", config);
  return config;
}
