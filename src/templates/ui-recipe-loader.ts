import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../utils/logger.js";
import { loadConfig } from "../config.js";
import type { UILayoutRecipe } from "./ui-recipe.js";

/**
 * UIRecipeLoader — loads, validates and caches UI layout recipes from
 * data/recipes/ui/*.json. Mirrors the prefab RecipeLoader in style.
 */
export class UIRecipeLoader {
  private cache: Map<string, UILayoutRecipe> = new Map();
  private loaded = false;

  getRecipe(id: string): UILayoutRecipe {
    this.ensureLoaded();
    const recipe = this.cache.get(id);
    if (!recipe) {
      throw new Error(
        `UI recipe not found: ${id}. Use action "list" to see available recipes.`
      );
    }
    return structuredClone(recipe);
  }

  listRecipes(): { id: string; name: string; description: string; category: string; params: string[] }[] {
    this.ensureLoaded();
    return Array.from(this.cache.values()).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      params: (r.params ?? []).map((p) => p.name),
    }));
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    // Set the guard first so any re-entrant call short-circuits.
    this.loaded = true;

    const config = loadConfig();
    const dir = join(config.dataDir, "recipes", "ui");

    if (!existsSync(dir)) {
      logger.warn(
        `UI recipes directory not found: ${dir}. Check dataDir (currently "${config.dataDir}").`
      );
      return;
    }

    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    } catch (e) {
      logger.warn(`Failed to read UI recipes dir ${dir}: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    for (const file of files) {
      const path = join(dir, file);
      try {
        const raw = readFileSync(path, "utf-8");
        const recipe = JSON.parse(raw) as UILayoutRecipe;
        this.validateRecipe(recipe);
        this.cache.set(recipe.id, recipe);
        logger.debug(`Loaded UI recipe: ${recipe.id}`);
      } catch (e) {
        const detail =
          e instanceof SyntaxError
            ? `invalid JSON: ${e.message}`
            : e instanceof Error
              ? e.message
              : String(e);
        logger.warn(`Failed to load UI recipe ${file}: ${detail}`);
      }
    }
  }

  private validateRecipe(recipe: UILayoutRecipe): void {
    if (!recipe.id || typeof recipe.id !== "string")
      throw new Error("UI recipe missing or invalid id");
    if (!recipe.name || typeof recipe.name !== "string")
      throw new Error("UI recipe missing or invalid name");
    if (!recipe.description || typeof recipe.description !== "string")
      throw new Error("UI recipe missing or invalid description");
    if (!recipe.category || typeof recipe.category !== "string")
      throw new Error("UI recipe missing or invalid category");
    if (!recipe.subdirectory || typeof recipe.subdirectory !== "string")
      throw new Error("UI recipe missing or invalid subdirectory");
    if (!recipe.tree || typeof recipe.tree !== "object")
      throw new Error("UI recipe missing or invalid tree");
    if (!recipe.tree.type || !recipe.tree.name)
      throw new Error("UI recipe tree must have a root type and name");
    if (recipe.params) {
      if (!Array.isArray(recipe.params)) throw new Error("UI recipe params must be an array");
      for (const p of recipe.params) {
        if (!p.name || typeof p.name !== "string")
          throw new Error("UI recipe param missing or invalid name");
      }
    }
  }
}

export const uiRecipeLoader = new UIRecipeLoader();
