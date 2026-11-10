import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Config } from "../config.js";
import {
  generateLayout,
  generateLayoutTree,
  getLayoutSubdirectory,
  getLayoutFilename,
  type LayoutType,
  type WidgetDef,
  type WidgetNode,
} from "../templates/layout.js";
import { validateFilename } from "../utils/safe-path.js";

// Recursive widget-tree schema for the parent-aware layout API.
type WidgetNodeInput = {
  type: string;
  name: string;
  slot?: Record<string, unknown>;
  props?: Record<string, string>;
  font?: { font: string; shadowSize?: number; shadowColor?: string };
  children?: WidgetNodeInput[];
};

const slotSchema = z
  .object({
    anchor: z.string().optional(),
    positionX: z.number().optional(),
    positionY: z.number().optional(),
    sizeX: z.number().optional(),
    sizeY: z.number().optional(),
    offsetLeft: z.number().optional(),
    offsetTop: z.number().optional(),
    offsetRight: z.number().optional(),
    offsetBottom: z.number().optional(),
    padding: z.string().optional(),
    horizontalAlign: z.union([z.string(), z.number()]).optional(),
    verticalAlign: z.union([z.string(), z.number()]).optional(),
    sizeMode: z.string().optional(),
    fillWeight: z.number().optional(),
    sizeToContent: z.union([z.boolean(), z.string()]).optional(),
  })
  .describe(
    "Slot properties. Which keys apply depends on the parent widget: Frame uses anchor/position/size/offset; layout widgets use padding/sizeMode/fillWeight; Overlay/Scale use horizontalAlign/verticalAlign/padding."
  );

const widgetNodeSchema: z.ZodType<WidgetNodeInput> = z.lazy(() =>
  z.object({
    type: z
      .string()
      .describe(
        "Friendly alias (Frame, VerticalLayout, HorizontalLayout, SizeLayout, Overlay, Scale, ScrollLayout, Text, RichText, Image, ProgressBar, Button) or a raw *WidgetClass name."
      ),
    name: z.string().describe("Widget Name for FindAnyWidget() lookups."),
    slot: slotSchema.optional(),
    props: z
      .record(z.string())
      .optional()
      .describe('Raw widget properties (Text, Opacity, Color, Texture, "Blend Mode", Current, Maximum, ...).'),
    font: z
      .object({
        font: z.string().describe('Font resource ref, e.g. "{GUID}UI/Fonts/.../X.fnt"'),
        shadowSize: z.number().optional(),
        shadowColor: z.string().optional(),
      })
      .optional()
      .describe("Expands to a FontProperties sub-node."),
    children: z.array(widgetNodeSchema).optional().describe("Nested child widgets."),
  })
);

export function registerLayoutCreate(server: McpServer, config: Config): void {
  server.registerTool(
    "layout_create",
    {
      description:
        "Create a UI layout (.layout) file for an Arma Reforger mod. Generates a properly structured layout in valid Enfusion text serialization format (correct parent-inferred Slot types, anonymous child blocks, FontProperties). Use for HUD elements, menus, dialogs, and custom UI. Provide `root` for a full nested widget tree (recommended for real HUDs), or use `layoutType` + `widgets` for the quick flat templates.",
      inputSchema: {
        name: z
          .string()
          .min(1)
          .describe("Layout name (e.g., 'HealthDisplay', 'ScoreboardMenu')"),
        root: widgetNodeSchema
          .optional()
          .describe(
            "Full widget tree (root widget with nested children). When provided, takes precedence over layoutType/widgets. The root carries no slot; every descendant's Slot type is inferred from its parent widget class."
          ),
        layoutType: z
          .enum(["hud", "menu", "dialog", "list", "custom"])
          .optional()
          .describe(
            "Flat template type (used when `root` is omitted). 'hud' bottom-left element. 'menu' centered panel. 'dialog' centered confirmation. 'list' left-side panel. 'custom' blank full-screen frame."
          ),
        rootWidgetType: z
          .string()
          .optional()
          .describe("Override the root widget class (default: FrameWidgetClass)"),
        anchor: z
          .string()
          .optional()
          .describe(
            "Root anchor as 'left top right bottom' floats 0-1 (e.g., '0 1 0 1' = bottom-left corner). Uses layout type default if omitted."
          ),
        offset: z
          .string()
          .optional()
          .describe(
            "Root offset as 'left top right bottom' in pixels relative to anchor (e.g., '20 -120 220 -20'). Uses layout type default if omitted."
          ),
        widgets: z
          .array(
            z.object({
              type: z
                .string()
                .describe(
                  "Widget class name: TextWidgetClass, ImageWidgetClass, ProgressBarWidgetClass, ButtonWidgetClass, RichTextWidgetClass, FrameWidgetClass, OverlayWidgetClass"
                ),
              name: z
                .string()
                .describe("Widget name for FindAnyWidget() lookups in scripts"),
              anchor: z
                .string()
                .optional()
                .describe("Anchor as 'left top right bottom' floats 0-1"),
              offset: z
                .string()
                .optional()
                .describe("Offset as 'left top right bottom' in pixels"),
              properties: z
                .record(z.string())
                .optional()
                .describe(
                  "Widget properties (e.g., Text, Color, ExactFontSize, Min, Max, Current, Align)"
                ),
            })
          )
          .optional()
          .describe(
            "Additional widgets to add beyond the layout type defaults. Each widget needs at minimum a type and name."
          ),
        description: z
          .string()
          .optional()
          .describe("Description comment for the layout"),
        projectPath: z
          .string()
          .optional()
          .describe("Addon root path. Uses configured default if omitted."),
      },
    },
    async ({ name, root, layoutType, rootWidgetType, anchor, offset, widgets, description, projectPath }) => {
      const basePath = projectPath || config.projectPath;

      try {
        validateFilename(name);

        const content = root
          ? generateLayoutTree(root as WidgetNode, description)
          : generateLayout({
              name,
              layoutType: (layoutType ?? "custom") as LayoutType,
              rootWidgetType,
              anchor,
              offset,
              widgets: widgets as WidgetDef[] | undefined,
              description,
            });

        if (basePath) {
          const subdir = getLayoutSubdirectory();
          const filename = getLayoutFilename(name);
          const targetDir = resolve(basePath, subdir);
          const targetPath = join(targetDir, filename);

          mkdirSync(targetDir, { recursive: true });

          if (existsSync(targetPath)) {
            return {
              content: [
                {
                  type: "text",
                  text: `File already exists: ${subdir}/${filename}\n\nGenerated content (not written):\n\n\`\`\`\n${content}\n\`\`\``,
                },
              ],
            };
          }

          writeFileSync(targetPath, content, "utf-8");

          return {
            content: [
              {
                type: "text",
                text: `Layout created: ${subdir}/${filename}\n\n\`\`\`\n${content}\n\`\`\``,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Generated layout (no project path configured  -  not written to disk):\n\n\`\`\`\n${content}\n\`\`\`\n\nSet ENFUSION_PROJECT_PATH to write files automatically.`,
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error creating layout: ${msg}` }],
        isError: true,
        };
      }
    }
  );
}
