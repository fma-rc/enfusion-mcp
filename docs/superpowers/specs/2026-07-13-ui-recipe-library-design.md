# UI Recipe Library — Design

Date: 2026-07-13
Status: Approved (user delegated decisions)
Depends on: UI layout engine (`generateLayoutTree`)

## Goal

Give the MCP a library of proven, parameterized HUD/menu blueprints extracted from the
ConflictEscalation mod, exposed through a `layout_recipe` tool — analogous to how prefab
recipes (`data/recipes/*.json` + the `prefab` tool) work, but for widget trees.

## Why a parallel system (not PrefabRecipe)

Prefab recipes describe `defaultParent` + `overrideComponents` (component-based). A UI blueprint is
a **widget tree** with **token substitution**. Different shape → its own schema and loader, kept
consistent in style with the prefab system (JSON data files, lazy-cached loader singleton, list/get).

## Schema (`data/recipes/ui/<id>.json`)

```jsonc
{
  "id": "status_hud",
  "name": "Status HUD",
  "description": "Top-center status text line (fade via script).",
  "category": "hud",                 // hud | menu | dialog | panel
  "subdirectory": "UI/layouts/HUD",  // output dir under the addon root
  "params": [
    { "name": "text", "description": "Initial status text", "default": "Status" },
    { "name": "fontSize", "description": "Font size", "default": "36" }
  ],
  "tree": { /* WidgetNode with {{token}} placeholders in string values */ },
  "postCreateNotes": [ "Find widget 'StatusText' via FindAnyWidget() to update at runtime" ]
}
```

Tokens: `{{param}}` occurrences in any string leaf of `tree` are replaced. A param map is built
from `params[].default` overlaid with caller-supplied values. Unresolved tokens are left literal
and reported.

## Components

- `src/templates/ui-recipe.ts` — types (`UIRecipeParam`, `UILayoutRecipe`) + `renderRecipe(recipe, params)`
  returning `{ tree: WidgetNode, subdirectory, postCreateNotes, unresolved: string[] }`. Deep-clones
  the tree and substitutes tokens in all string leaves.
- `src/templates/ui-recipe-loader.ts` — `UIRecipeLoader` singleton mirroring `RecipeLoader`: scans
  `<dataDir>/recipes/ui/*.json`, validates, caches, `listRecipes()` / `getRecipe(id)`.
- `src/tools/layout-recipe.ts` — `layout_recipe` tool. `action: "list"` returns available recipes;
  `action: "create"` (default) renders a recipe to `<subdirectory>/<name>.layout` via
  `generateLayoutTree`, returns content + checklist.
- `data/recipes/ui/*.json` — initial blueprints.
- register in `src/server.ts`.
- `tests/templates/ui-recipe.test.ts`, `tests/tools/layout-recipe.test.ts`.

## Initial blueprints (from the mod)

| id            | idiom / source                    | params                       |
|---------------|-----------------------------------|------------------------------|
| status_hud    | SeedingStateStatusHUD (top-center RichText) | text, fontSize     |
| timer_hud     | BattlePrepTimerHUD (centered countdown)     | label, fontSize    |
| icon_overlay  | EarplugsHUD (edge icon, Opacity 0, additive)| texture, name      |
| progress_hud  | CampaignMainHUD capture bar (label + ProgressBar) | label, color |
| info_panel    | generic bottom-left titled panel  | title, line1, line2          |

All trees are self-contained (no external Prefab/inheritance refs), so they generate standalone.

## Testing

- `renderRecipe` substitutes tokens, honors defaults, deep-clones (no mutation of cached recipe),
  reports unresolved tokens.
- Loader loads all shipped recipes and validates them.
- Tool `list` returns every recipe; `create` produces a parseable layout containing substituted
  values; unknown recipe id errors cleanly.
- Each shipped JSON: valid, its `tree` generates output that `parse()` accepts.

## Out of scope

Gamemode scaffolding (#3), KB extraction (#4), layout inheritance / external Prefab refs.
