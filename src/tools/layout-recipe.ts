import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Config } from "../config.js";
import { generateLayoutTree } from "../templates/layout.js";
import { uiRecipeLoader } from "../templates/ui-recipe-loader.js";
import { renderRecipe } from "../templates/ui-recipe.js";
import { validateFilename } from "../utils/safe-path.js";

export function registerLayoutRecipe(server: McpServer, config: Config): void {
  server.registerTool(
    "layout_recipe",
    {
      description:
        "Generate a UI layout (.layout) from a proven blueprint recipe (extracted from real Arma Reforger HUDs). Use action 'list' to see available recipes (status_hud, timer_hud, icon_overlay, progress_hud, info_panel, ...) and their parameters, then action 'create' with a recipe id + name + params to write a production-shaped layout. Prefer this over layout_create when a blueprint fits.",
      inputSchema: {
        action: z
          .enum(["list", "create"])
          .optional()
          .describe("'list' shows available recipes; 'create' (default) writes a layout from a recipe."),
        recipe: z
          .string()
          .optional()
          .describe("Recipe id (required for 'create'). See action 'list'."),
        name: z
          .string()
          .optional()
          .describe("Output layout name / filename (required for 'create'), e.g. 'SeedingStatusHUD'."),
        params: z
          .record(z.string())
          .optional()
          .describe("Parameter values substituted into the blueprint (e.g. { text: '<b>Seeding</b>', fontSize: '40' }). Unspecified params use recipe defaults."),
        projectPath: z
          .string()
          .optional()
          .describe("Addon root path. Uses configured default if omitted."),
      },
    },
    async ({ action, recipe, name, params, projectPath }) => {
      try {
        if ((action ?? "create") === "list") {
          const recipes = uiRecipeLoader.listRecipes();
          if (recipes.length === 0) {
            return {
              content: [{ type: "text", text: "No UI recipes found. Check that data/recipes/ui/ exists in the MCP install." }],
            };
          }
          const lines = recipes.map(
            (r) => `- ${r.id} (${r.category}) — ${r.name}: ${r.description}\n    params: ${r.params.join(", ") || "(none)"}`
          );
          return {
            content: [{ type: "text", text: `Available UI recipes:\n\n${lines.join("\n")}` }],
          };
        }

        // create
        if (!recipe) {
          return {
            content: [{ type: "text", text: "Error: 'recipe' is required for create. Use action 'list' to see options." }],
            isError: true,
          };
        }
        if (!name) {
          return {
            content: [{ type: "text", text: "Error: 'name' is required for create." }],
            isError: true,
          };
        }
        validateFilename(name);

        const loaded = uiRecipeLoader.getRecipe(recipe);
        const rendered = renderRecipe(loaded, params ?? {});
        const content = generateLayoutTree(rendered.tree);

        const notes = rendered.postCreateNotes.length > 0
          ? "\n\nFollow-up:\n" + rendered.postCreateNotes.map((n) => `[ ] ${n}`).join("\n")
          : "";
        const warn = rendered.unresolved.length > 0
          ? `\n\nWarning: unresolved placeholders left literal: ${rendered.unresolved.join(", ")}`
          : "";

        const basePath = projectPath || config.projectPath;
        if (basePath) {
          const targetDir = resolve(basePath, rendered.subdirectory);
          const targetPath = join(targetDir, `${name}.layout`);
          mkdirSync(targetDir, { recursive: true });

          if (existsSync(targetPath)) {
            return {
              content: [{
                type: "text",
                text: `File already exists: ${rendered.subdirectory}/${name}.layout\n\nGenerated content (not written):\n\n\`\`\`\n${content}\n\`\`\`${warn}`,
              }],
            };
          }

          writeFileSync(targetPath, content, "utf-8");
          return {
            content: [{
              type: "text",
              text: `Layout created from recipe '${recipe}': ${rendered.subdirectory}/${name}.layout\n\n\`\`\`\n${content}\n\`\`\`${notes}${warn}`,
            }],
          };
        }

        return {
          content: [{
            type: "text",
            text: `Generated layout from recipe '${recipe}' (no project path configured — not written):\n\n\`\`\`\n${content}\n\`\`\`${notes}${warn}\n\nSet ENFUSION_PROJECT_PATH to write files automatically.`,
          }],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
