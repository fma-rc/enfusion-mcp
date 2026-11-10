/**
 * UI Layout Recipe System — schema + renderer.
 *
 * A UI recipe is a parameterized widget-tree blueprint (unlike prefab recipes,
 * which are component-override based). Recipes live as JSON in data/recipes/ui/
 * and carry a `tree` (WidgetNode) whose string leaves may contain `{{token}}`
 * placeholders substituted from `params`.
 */
import type { WidgetNode } from "./layout.js";

export interface UIRecipeParam {
  /** Token name — `{{name}}` occurrences in the tree are replaced. */
  name: string;
  /** Human-readable description. */
  description: string;
  /** Default value used when the caller does not supply one. */
  default?: string;
}

export interface UILayoutRecipe {
  /** Unique recipe id (matches the filename). */
  id: string;
  /** Display name. */
  name: string;
  /** Human-readable description. */
  description: string;
  /** Blueprint category: hud | menu | dialog | panel. */
  category: string;
  /** Output subdirectory under the addon root (e.g. "UI/layouts/HUD"). */
  subdirectory: string;
  /** Declared parameters. */
  params?: UIRecipeParam[];
  /** Widget tree with `{{token}}` placeholders. */
  tree: WidgetNode;
  /** Post-creation checklist for users. */
  postCreateNotes?: string[];
}

export interface RenderedRecipe {
  tree: WidgetNode;
  subdirectory: string;
  postCreateNotes: string[];
  /** Token names referenced by the tree that had no value or default. */
  unresolved: string[];
}

const TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Substitute `{{token}}` occurrences in a string, tracking unresolved tokens. */
function substitute(value: string, params: Record<string, string>, unresolved: Set<string>): string {
  return value.replace(TOKEN_RE, (_match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      return params[key];
    }
    unresolved.add(key);
    return _match;
  });
}

/** Recursively substitute tokens in every string leaf of a widget node. */
function substituteNode(
  node: WidgetNode,
  params: Record<string, string>,
  unresolved: Set<string>
): WidgetNode {
  const out: WidgetNode = {
    type: substitute(node.type, params, unresolved),
    name: substitute(node.name, params, unresolved),
  };

  if (node.slot) {
    const slot: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node.slot)) {
      slot[k] = typeof v === "string" ? substitute(v, params, unresolved) : v;
    }
    out.slot = slot as WidgetNode["slot"];
  }

  if (node.props) {
    const props: Record<string, string> = {};
    for (const [k, v] of Object.entries(node.props)) {
      props[substitute(k, params, unresolved)] = substitute(v, params, unresolved);
    }
    out.props = props;
  }

  if (node.font) {
    out.font = {
      font: substitute(node.font.font, params, unresolved),
      shadowSize: node.font.shadowSize,
      shadowColor:
        node.font.shadowColor !== undefined
          ? substitute(node.font.shadowColor, params, unresolved)
          : undefined,
    };
  }

  if (node.children) {
    out.children = node.children.map((c) => substituteNode(c, params, unresolved));
  }

  return out;
}

/**
 * Render a recipe into a concrete widget tree by substituting parameters.
 * Caller-supplied values override the recipe's declared defaults. The cached
 * recipe is never mutated (the tree is rebuilt).
 */
export function renderRecipe(
  recipe: UILayoutRecipe,
  params: Record<string, string> = {}
): RenderedRecipe {
  const resolved: Record<string, string> = {};
  for (const p of recipe.params ?? []) {
    if (p.default !== undefined) resolved[p.name] = p.default;
  }
  for (const [k, v] of Object.entries(params)) {
    resolved[k] = v;
  }

  const unresolved = new Set<string>();
  const tree = substituteNode(recipe.tree, resolved, unresolved);

  return {
    tree,
    subdirectory: recipe.subdirectory,
    postCreateNotes: recipe.postCreateNotes ?? [],
    unresolved: Array.from(unresolved),
  };
}
