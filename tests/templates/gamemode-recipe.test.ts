import { describe, it, expect } from "vitest";
import { composeGamemode, type GamemodeFeature } from "../../src/templates/gamemode-recipe.js";
import { gamemodeRecipeLoader } from "../../src/templates/gamemode-recipe-loader.js";

/** Count balanced braces to catch obviously broken output. */
function bracesBalanced(code: string): boolean {
  let depth = 0;
  for (const ch of code) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

const featA: GamemodeFeature = {
  id: "a",
  name: "Feature A",
  description: "d",
  category: "Cat",
  attributes: ["[Attribute()]\nprotected bool m_bA;"],
  getters: ["bool GetA() { return m_bA; }"],
  overrides: [{ signature: "void OnGameModeStart()", superCall: true, body: ["DoA();"] }],
  notes: ["note A"],
};

const featB: GamemodeFeature = {
  id: "b",
  name: "Feature B",
  description: "d",
  category: "Cat",
  methods: ["protected void HelperB()\n{\n    return;\n}"],
  overrides: [{ signature: "void OnGameModeStart()", superCall: true, body: ["DoB();"] }],
  notes: ["note B"],
};

const featGuard: GamemodeFeature = {
  id: "guard",
  name: "Guard",
  description: "d",
  category: "Cat",
  overrides: [
    { signature: "bool CanPlayerSpawn_S(int playerId)", superCall: false, body: ["if (!super.CanPlayerSpawn_S(playerId)) return false;", "return true;"] },
  ],
};

describe("composeGamemode", () => {
  it("merges two features overriding the same method into one override", () => {
    const { code } = composeGamemode([featA, featB]);
    // Exactly one OnGameModeStart override and one super call.
    expect(code.match(/override void OnGameModeStart\(\)/g)?.length).toBe(1);
    expect(code.match(/super\.OnGameModeStart\(\);/g)?.length).toBe(1);
    expect(code).toContain("DoA();");
    expect(code).toContain("DoB();");
    expect(code).toContain("// --- Feature A ---");
    expect(code).toContain("// --- Feature B ---");
  });

  it("emits no auto super when superCall is false", () => {
    const { code } = composeGamemode([featGuard]);
    expect(code).toContain("override bool CanPlayerSpawn_S(int playerId)");
    // The only super reference is the one inside the authored guard body.
    expect(code.match(/super\.CanPlayerSpawn_S/g)?.length).toBe(1);
  });

  it("includes attributes, getters, and helper methods", () => {
    const { code } = composeGamemode([featA, featB]);
    expect(code).toContain("protected bool m_bA;");
    expect(code).toContain("bool GetA() { return m_bA; }");
    expect(code).toContain("protected void HelperB()");
  });

  it("collects notes tagged by feature id", () => {
    const { notes } = composeGamemode([featA, featB]);
    expect(notes).toContain("[a] note A");
    expect(notes).toContain("[b] note B");
  });

  it("produces a single modded-class block with balanced braces", () => {
    const { code } = composeGamemode([featA, featB, featGuard]);
    expect(code.match(/modded class SCR_GameModeCampaign/g)?.length).toBe(1);
    expect(bracesBalanced(code)).toBe(true);
  });

  it("places helper classes before and companion classes after the modded class", () => {
    const withClasses: GamemodeFeature = {
      id: "c", name: "C", description: "d", category: "Cat",
      helperClasses: ["class HelperUtil\n{\n}"],
      companionClasses: ["modded class SCR_Other\n{\n}"],
    };
    const { code } = composeGamemode([withClasses]);
    const helperIdx = code.indexOf("class HelperUtil");
    const moddedIdx = code.indexOf("modded class SCR_GameModeCampaign");
    const companionIdx = code.indexOf("modded class SCR_Other");
    expect(helperIdx).toBeGreaterThanOrEqual(0);
    expect(helperIdx).toBeLessThan(moddedIdx);
    expect(companionIdx).toBeGreaterThan(moddedIdx);
  });
});

describe("gamemodeRecipeLoader (shipped features)", () => {
  const EXPECTED = ["battle_prep", "seeding", "scaled_respawn", "auto_load_save", "spawn_validation", "ambient_ai", "rank_persistence"];

  it("loads every shipped feature", () => {
    const ids = gamemodeRecipeLoader.listFeatures().map((f) => f.id);
    for (const id of EXPECTED) expect(ids).toContain(id);
  });

  it("composes all shipped features into valid-looking output", () => {
    const features = gamemodeRecipeLoader.getFeatures(EXPECTED);
    const { code, notes } = composeGamemode(features, { description: "All features" });
    expect(code.match(/modded class SCR_GameModeCampaign/g)?.length).toBe(1);
    expect(bracesBalanced(code)).toBe(true);
    // battle_prep + auto_load_save both hit OnGameModeStart -> merged to one.
    expect(code.match(/override void OnGameModeStart\(\)/g)?.length).toBe(1);
    // rank_persistence contributes a helper class and a companion class.
    expect(code).toContain("class PersistentRank_Util");
    expect(code).toContain("modded class SCR_CharacterRankComponent");
    expect(notes.length).toBeGreaterThan(0);
  });

  it("throws for an unknown feature", () => {
    expect(() => gamemodeRecipeLoader.getFeature("nope")).toThrow(/not found/);
  });
});
