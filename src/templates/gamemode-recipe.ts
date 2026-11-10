/**
 * Campaign Gamemode Scaffolder — schema + composer.
 *
 * Each feature recipe contributes attributes/getters/methods/overrides to a single
 * `modded class SCR_GameModeCampaign`. Multiple features that override the same method
 * (e.g. OnGameModeStart) are merged into one override with each body appended.
 * Verified against patterns/GameModes_And_Scenarios/modded-gamemode-cookbook.md.
 */

export interface GMOverride {
  /** e.g. "void OnGameModeStart()" or "bool CanPlayerSpawn_S(int playerId)" */
  signature: string;
  /** Auto-emit `super.<name>(<params>);` first. Default true. Set false for guard-style bodies. */
  superCall?: boolean;
  /** Body lines (indented under the method; may themselves contain relative indentation). */
  body: string[];
}

export interface GamemodeFeature {
  id: string;
  name: string;
  description: string;
  category: string;
  /** Full member declarations, e.g. an [Attribute(...)] + field (may be multi-line). */
  attributes?: string[];
  /** Getter one-liners. */
  getters?: string[];
  /** Full non-override method blocks (0-indented; re-indented on emit). */
  methods?: string[];
  /** Overrides (merged across features by signature). */
  overrides?: GMOverride[];
  /** Full class blocks emitted before the modded class (0-indented). */
  helperClasses?: string[];
  /** Full class blocks emitted after the modded class (0-indented). */
  companionClasses?: string[];
  /** Non-code follow-up notes (layer/prefab side); surfaced separately, not written to the file. */
  notes?: string[];
}

export interface ComposeOptions {
  /** Target base class. Default "SCR_GameModeCampaign". */
  targetClass?: string;
  /** Optional header description. */
  description?: string;
}

export interface ComposedGamemode {
  code: string;
  notes: string[];
}

const IND = "    "; // 4-space indent

/** Prefix every non-empty line of a block with `pad`, preserving relative indentation. */
function indentBlock(text: string, pad: string): string {
  return text
    .split("\n")
    .map((line) => (line.trim().length === 0 ? "" : pad + line))
    .join("\n");
}

/** Extract the method name from a signature: "bool CanPlayerSpawn_S(int p)" -> "CanPlayerSpawn_S". */
function methodName(signature: string): string {
  const match = signature.match(/(\w+)\s*\(/);
  return match ? match[1] : signature;
}

/** Extract comma-joined parameter names for super forwarding. */
function paramNames(signature: string): string {
  const match = signature.match(/\(([^)]*)\)/);
  if (!match || !match[1].trim()) return "";
  return match[1]
    .split(",")
    .map((p) => {
      const withoutDefault = p.split("=")[0].trim();
      const parts = withoutDefault.split(/\s+/);
      return parts[parts.length - 1];
    })
    .join(", ");
}

/** De-duplicate a list of code blocks, preserving order. */
function dedupe(blocks: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of blocks) {
    const key = b.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

interface MergedOverride {
  signature: string;
  superCall: boolean;
  contributions: { feature: string; body: string[] }[];
}

/**
 * Compose selected features into a single modded-class scaffold.
 */
export function composeGamemode(
  features: GamemodeFeature[],
  opts: ComposeOptions = {}
): ComposedGamemode {
  const targetClass = opts.targetClass ?? "SCR_GameModeCampaign";
  const lines: string[] = [];

  // Header
  if (opts.description) lines.push(`// ${opts.description}`);
  lines.push(`// Modded ${targetClass} scaffold — features: ${features.map((f) => f.id).join(", ")}`);
  lines.push("// Generated from cookbook-verified gamemode patterns. Review before shipping.");
  lines.push("");

  // Helper classes (before the modded class)
  const helpers = dedupe(features.flatMap((f) => f.helperClasses ?? []));
  for (const h of helpers) {
    lines.push(h.trimEnd());
    lines.push("");
  }

  // Merge overrides by signature (preserve first-seen order)
  const mergedMap = new Map<string, MergedOverride>();
  for (const f of features) {
    for (const ov of f.overrides ?? []) {
      let m = mergedMap.get(ov.signature);
      if (!m) {
        m = { signature: ov.signature, superCall: true, contributions: [] };
        mergedMap.set(ov.signature, m);
      }
      // Auto super only if EVERY contributor opts in (undefined defaults to true).
      if (ov.superCall === false) m.superCall = false;
      m.contributions.push({ feature: f.name, body: ov.body });
    }
  }

  // Modded class body
  lines.push(`modded class ${targetClass}`);
  lines.push("{");

  const bodyParts: string[] = [];

  // Per-feature attributes + getters
  for (const f of features) {
    const hasMembers = (f.attributes?.length ?? 0) > 0 || (f.getters?.length ?? 0) > 0;
    if (!hasMembers) continue;
    const section: string[] = [];
    section.push(`${IND}// ===== Feature: ${f.name} =====`);
    for (const attr of f.attributes ?? []) {
      section.push(indentBlock(attr.trimEnd(), IND));
    }
    if ((f.attributes?.length ?? 0) > 0 && (f.getters?.length ?? 0) > 0) section.push("");
    for (const g of f.getters ?? []) {
      section.push(`${IND}${g.trim()}`);
    }
    bodyParts.push(section.join("\n"));
  }

  // Methods (non-override)
  const methods = features.flatMap((f) => f.methods ?? []);
  if (methods.length > 0) {
    const section: string[] = [`${IND}// ----- Helper methods -----`];
    for (const m of methods) {
      section.push(indentBlock(m.trimEnd(), IND));
      section.push("");
    }
    bodyParts.push(section.join("\n").trimEnd());
  }

  // Merged overrides
  if (mergedMap.size > 0) {
    const section: string[] = [`${IND}// ----- Overrides -----`];
    for (const m of mergedMap.values()) {
      section.push(`${IND}override ${m.signature}`);
      section.push(`${IND}{`);
      if (m.superCall) {
        section.push(`${IND}${IND}super.${methodName(m.signature)}(${paramNames(m.signature)});`);
      }
      for (const c of m.contributions) {
        if (m.contributions.length > 1) section.push(`${IND}${IND}// --- ${c.feature} ---`);
        for (const bl of c.body) {
          section.push(bl.trim().length === 0 ? "" : `${IND}${IND}${bl}`);
        }
      }
      section.push(`${IND}}`);
      section.push("");
    }
    bodyParts.push(section.join("\n").trimEnd());
  }

  lines.push(bodyParts.join("\n\n"));
  lines.push("}");

  // Companion classes (after the modded class)
  const companions = dedupe(features.flatMap((f) => f.companionClasses ?? []));
  for (const c of companions) {
    lines.push("");
    lines.push(c.trimEnd());
  }

  lines.push("");

  const notes = features.flatMap((f) => (f.notes ?? []).map((n) => `[${f.id}] ${n}`));

  return { code: lines.join("\n"), notes };
}
