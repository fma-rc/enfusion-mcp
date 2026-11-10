import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../utils/logger.js";
import { loadConfig } from "../config.js";
import type { GamemodeFeature } from "./gamemode-recipe.js";

/**
 * GamemodeRecipeLoader — loads/validates/caches campaign gamemode feature recipes
 * from data/recipes/gamemode/*.json. Mirrors the UI recipe loader.
 */
export class GamemodeRecipeLoader {
  private cache: Map<string, GamemodeFeature> = new Map();
  private loaded = false;

  getFeature(id: string): GamemodeFeature {
    this.ensureLoaded();
    const f = this.cache.get(id);
    if (!f) {
      throw new Error(`Gamemode feature not found: ${id}. Use action "list" to see available features.`);
    }
    return structuredClone(f);
  }

  getFeatures(ids: string[]): GamemodeFeature[] {
    return ids.map((id) => this.getFeature(id));
  }

  listFeatures(): { id: string; name: string; description: string; category: string }[] {
    this.ensureLoaded();
    return Array.from(this.cache.values()).map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      category: f.category,
    }));
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true; // set first so any re-entrant call short-circuits

    const config = loadConfig();
    const dir = join(config.dataDir, "recipes", "gamemode");

    if (!existsSync(dir)) {
      logger.warn(`Gamemode recipes directory not found: ${dir}. Check dataDir ("${config.dataDir}").`);
      return;
    }

    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    } catch (e) {
      logger.warn(`Failed to read gamemode recipes dir ${dir}: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    for (const file of files) {
      const path = join(dir, file);
      try {
        const raw = readFileSync(path, "utf-8");
        const feature = JSON.parse(raw) as GamemodeFeature;
        this.validate(feature);
        this.cache.set(feature.id, feature);
        logger.debug(`Loaded gamemode feature: ${feature.id}`);
      } catch (e) {
        const detail =
          e instanceof SyntaxError
            ? `invalid JSON: ${e.message}`
            : e instanceof Error
              ? e.message
              : String(e);
        logger.warn(`Failed to load gamemode feature ${file}: ${detail}`);
      }
    }
  }

  private validate(f: GamemodeFeature): void {
    if (!f.id || typeof f.id !== "string") throw new Error("Feature missing or invalid id");
    if (!f.name || typeof f.name !== "string") throw new Error("Feature missing or invalid name");
    if (!f.description || typeof f.description !== "string")
      throw new Error("Feature missing or invalid description");
    if (!f.category || typeof f.category !== "string")
      throw new Error("Feature missing or invalid category");
    if (f.overrides) {
      if (!Array.isArray(f.overrides)) throw new Error("Feature overrides must be an array");
      for (const ov of f.overrides) {
        if (!ov.signature || typeof ov.signature !== "string")
          throw new Error("Override missing or invalid signature");
        if (!Array.isArray(ov.body)) throw new Error("Override body must be an array of lines");
      }
    }
  }
}

export const gamemodeRecipeLoader = new GamemodeRecipeLoader();
