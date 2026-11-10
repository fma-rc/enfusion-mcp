import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Config } from "../config.js";
import { gamemodeRecipeLoader } from "../templates/gamemode-recipe-loader.js";
import { composeGamemode } from "../templates/gamemode-recipe.js";

const OUTPUT_SUBDIR = "scripts/Game/GameMode";
const OUTPUT_FILE = "SCR_GameModeCampaign_modded.c";

export function registerGamemodeScaffold(server: McpServer, config: Config): void {
  server.registerTool(
    "gamemode_scaffold",
    {
      description:
        "Scaffold a modded SCR_GameModeCampaign for Conflict by composing cookbook-verified feature recipes (battle_prep, seeding, scaled_respawn, auto_load_save, spawn_validation, ambient_ai, rank_persistence, ...). Features that override the same method are merged into one override. Use action 'list' to see features; action 'create' with a features[] array to write scripts/Game/GameMode/SCR_GameModeCampaign_modded.c.",
      inputSchema: {
        action: z
          .enum(["list", "create"])
          .optional()
          .describe("'list' shows available features; 'create' (default) writes the modded gamemode file."),
        features: z
          .array(z.string())
          .optional()
          .describe("Feature ids to compose (required for 'create'), e.g. ['battle_prep','auto_load_save']."),
        description: z
          .string()
          .optional()
          .describe("Optional header comment for the generated file."),
        projectPath: z
          .string()
          .optional()
          .describe("Addon root path. Uses configured default if omitted."),
      },
    },
    async ({ action, features, description, projectPath }) => {
      try {
        if ((action ?? "create") === "list") {
          const list = gamemodeRecipeLoader.listFeatures();
          if (list.length === 0) {
            return { content: [{ type: "text", text: "No gamemode features found. Check data/recipes/gamemode/." }] };
          }
          const lines = list.map((f) => `- ${f.id} (${f.category}) — ${f.name}: ${f.description}`);
          return { content: [{ type: "text", text: `Available gamemode features:\n\n${lines.join("\n")}` }] };
        }

        // create
        if (!features || features.length === 0) {
          return {
            content: [{ type: "text", text: "Error: 'features' (non-empty array) is required for create. Use action 'list'." }],
            isError: true,
          };
        }

        const loaded = gamemodeRecipeLoader.getFeatures(features);
        const composed = composeGamemode(loaded, { description });

        const notes = composed.notes.length > 0
          ? "\n\nLayer/prefab follow-up:\n" + composed.notes.map((n) => `[ ] ${n}`).join("\n")
          : "";

        const basePath = projectPath || config.projectPath;
        if (basePath) {
          const targetDir = resolve(basePath, OUTPUT_SUBDIR);
          const targetPath = join(targetDir, OUTPUT_FILE);
          mkdirSync(targetDir, { recursive: true });

          if (existsSync(targetPath)) {
            return {
              content: [{
                type: "text",
                text: `File already exists: ${OUTPUT_SUBDIR}/${OUTPUT_FILE}\n\nGenerated content (not written — merge manually):\n\n\`\`\`c\n${composed.code}\n\`\`\`${notes}`,
              }],
            };
          }

          writeFileSync(targetPath, composed.code, "utf-8");
          return {
            content: [{
              type: "text",
              text: `Gamemode scaffold created: ${OUTPUT_SUBDIR}/${OUTPUT_FILE}\n\n\`\`\`c\n${composed.code}\n\`\`\`${notes}`,
            }],
          };
        }

        return {
          content: [{
            type: "text",
            text: `Generated gamemode scaffold (no project path configured — not written):\n\n\`\`\`c\n${composed.code}\n\`\`\`${notes}\n\nSet ENFUSION_PROJECT_PATH to write files automatically.`,
          }],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
