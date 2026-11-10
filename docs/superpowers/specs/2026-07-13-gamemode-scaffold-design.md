# Campaign Gamemode Scaffolder — Design

Date: 2026-07-13
Status: Approved (user delegated decisions)
Source: patterns/GameModes_And_Scenarios/modded-gamemode-cookbook.md (10 verified patterns) +
ConflictEscalation `SCR_GameModeCampaign_modded.c`.

## Goal

Generate a real `modded class SCR_GameModeCampaign` from composable, cookbook-verified feature
recipes — not empty stubs. Picking multiple features merges their overrides (e.g. `battle_prep` +
`auto_load_save` both contribute to one `OnGameModeStart`).

## Feature recipe schema (`data/recipes/gamemode/<id>.json`)

```jsonc
{
  "id": "battle_prep",
  "name": "Battle Prep Timer",
  "description": "...",
  "category": "Battle Prep",
  "attributes": ["[Attribute(...)]\nprotected bool m_bShowBattlePrepTimer;"],
  "getters": ["bool ShowBattlePrepTimer() { return m_bShowBattlePrepTimer; }"],
  "methods": ["protected void EndBattlePrep()\n{\n    SetBattlePrepEnded(true);\n}"],
  "overrides": [
    { "signature": "void OnGameModeStart()", "superCall": true,
      "body": ["if (m_bShowBattlePrepTimer && Replication.IsServer())",
               "    GetGame().GetCallqueue().CallLater(EndBattlePrep, m_iBattlePrepTimeS * 1000, false);"] }
  ],
  "helperClasses": ["class Foo { ... }"],        // emitted before the modded class
  "companionClasses": ["modded class Bar { ... }"], // emitted after
  "notes": ["Layer-side: add IRON_SeedingRestrictionZoneEntity ..."]
}
```

## Composition (`composeGamemode(features, opts)`)

Emits one file:
1. Header comment (feature list).
2. `helperClasses` verbatim (column 0), de-duplicated.
3. `modded class SCR_GameModeCampaign {`
   - Per feature: `// ===== Feature: <name> =====`, its attributes, its getters.
   - All `methods` (4-space indented).
   - Merged overrides: group by signature. Auto-emit `super.<name>(<params>);` once **iff every**
     contributing feature has `superCall !== false`; then each feature's body under a
     `// --- <name> ---` comment. Return type/name/params parsed from the signature.
4. `}`.
5. `companionClasses` verbatim, de-duplicated.

`notes` are collected and returned separately (printed as a follow-up checklist by the tool, not
written into the file).

## Components

- `src/templates/gamemode-recipe.ts` — types + `composeGamemode`.
- `src/templates/gamemode-recipe-loader.ts` — loader for `data/recipes/gamemode/*.json` (mirrors the
  UI recipe loader; lazy guard set before scan).
- `src/tools/gamemode-scaffold.ts` — `gamemode_scaffold` tool: `action: "list"` shows features;
  `action: "create"` composes selected `features` into
  `scripts/Game/GameMode/SCR_GameModeCampaign_modded.c`.
- `data/recipes/gamemode/*.json` — initial features.
- register in `src/server.ts`.
- `tests/templates/gamemode-recipe.test.ts`.

## Initial features

`battle_prep`, `seeding`, `scaled_respawn`, `auto_load_save`, `spawn_validation`, `ambient_ai`,
`rank_persistence` (exercises helperClasses + companionClasses + a merge on `OnGameModeStart`).

## Testing

- Merge: `battle_prep` + `auto_load_save` produce exactly one `override void OnGameModeStart` with
  one `super.OnGameModeStart();` and both bodies.
- `spawn_validation` (superCall false) emits no auto super.
- Attributes/getters/methods/helper/companion classes all appear; notes surface separately.
- Every shipped feature loads and validates; a scaffold of all features compiles structurally
  (balanced braces, single modded-class block).

## Out of scope

GameModeSetup `.conf` generation, layer/prefab generation (#4 covers KB; layers already in KB).
