# UI Layout Engine Rewrite — Design

Date: 2026-07-13
Status: Approved (user delegated all design decisions)

## Problem

The MCP's `layout_create` tool (`src/tools/layout-create.ts` + `src/templates/layout.ts`)
cannot produce production-grade Enfusion UI layouts. Verified against the ConflictEscalation
mod's real `.layout` files, the current generator has four defects:

1. **Invalid children wrapper.** It emits a named `Children { ... }` node. Real layouts have
   **no** `Children` keyword — child widgets live in an **anonymous `{ }` block** after the
   parent's properties/slot. (Confirmed: `grep Children` across all mod layouts = 0 hits.)
2. **Wrong slot type.** It hardcodes `Slot FrameWidgetSlot` for every widget. The slot **type is
   determined by the parent widget class**, not fixed.
3. **Missing widget vocabulary.** No `VerticalLayoutWidgetClass`, `HorizontalLayoutWidgetClass`,
   `SizeLayoutWidgetClass`, `OverlayWidgetClass`, `ScaleWidgetClass`, `ScrollLayoutWidgetClass`;
   no `FontProperties` sub-node, `Blend Mode`, `Texture`, alignment enums, or ProgressBar
   `Current/Maximum`.
4. **Emits a slot on the root.** Real root widgets (`rootFrame`) carry **no** `Slot` — only
   children do.

Net effect: the 5 hardcoded flat templates cannot express a nested real HUD.

## Slot-type inference (parent widget class -> child slot type)

Derived from the mod's layouts (LayoutSlot=103, OverlayWidgetSlot=28, FrameWidgetSlot=22,
AlignableSlot=9):

| Parent widget class            | Child slot type    |
|--------------------------------|--------------------|
| FrameWidgetClass               | FrameWidgetSlot    |
| VerticalLayoutWidgetClass      | LayoutSlot         |
| HorizontalLayoutWidgetClass    | LayoutSlot         |
| SizeLayoutWidgetClass          | LayoutSlot         |
| ScrollLayoutWidgetClass        | LayoutSlot         |
| OverlayWidgetClass             | OverlayWidgetSlot  |
| ScaleWidgetClass               | AlignableSlot      |
| (default / unknown)            | LayoutSlot         |

Root widget: no slot emitted.

## Solution: parent-aware widget tree

Rewrite `src/templates/layout.ts` around a nested `WidgetNode` tree. The engine walks the tree,
picks each child's slot type from its parent, and emits an anonymous `{ }` block for children.

### WidgetNode model

```ts
interface LayoutSlotDef {
  anchor?: string;            // "l t r b" 0-1 (FrameWidgetSlot)
  positionX?: number; positionY?: number;   // OffsetLeft/OffsetTop mirror
  sizeX?: number; sizeY?: number;           // OffsetRight/OffsetBottom mirror
  offsetLeft?: number; offsetTop?: number; offsetRight?: number; offsetBottom?: number;
  padding?: string;          // "l t r b" (LayoutSlot/OverlayWidgetSlot)
  horizontalAlign?: string; verticalAlign?: string;
  sizeMode?: string; fillWeight?: number; sizeToContent?: boolean | string;
}

interface FontDef {
  font: string;              // "{guid}UI/Fonts/.../X.fnt"
  shadowSize?: number; shadowColor?: string;
}

interface WidgetNode {
  type: string;              // friendly alias OR raw *WidgetClass
  name: string;
  slot?: LayoutSlotDef;      // ignored for the root
  props?: Record<string, string>;  // Text, Opacity, Color, Texture, "Blend Mode", Current, Maximum...
  font?: FontDef;            // expands to FontProperties sub-node
  children?: WidgetNode[];
}
```

### Friendly aliases -> class names

`Frame`, `VerticalLayout`, `HorizontalLayout`, `SizeLayout`, `Overlay`, `Scale`, `ScrollLayout`,
`Text`, `RichText`, `Image`, `ProgressBar`, `Button` -> corresponding `*WidgetClass`. Raw class
names pass through unchanged.

### Serialization mapping (reuse existing enfusion-text serializer)

- Widget = node `type=<WidgetClass>`, `id="{guid}"`, property `Name "<name>"`.
- Slot = **child node** `type="Slot"`, `className=<slotType>`, `id="{guid}"`, with slot props.
  (The serializer emits `Slot FrameWidgetSlot "{guid}" { ... }` because a node's className and id
  render after the type; a property-valued node would drop the key.)
- FontProperties = child node `type="FontProperties"`, `className="FontProperties"`, `id="{guid}"`.
- Anonymous children block = child node with `type=""` -> serializes as ` { ... }`.
- Root emits no Slot.

## Backward compatibility

Keep `generateLayout(opts: LayoutOptions)` and the 5 `LAYOUT_CONFIGS` templates working. Internally
they now build a `WidgetNode` tree and delegate to the new `generateLayoutTree(root, description?)`,
which fixes the Children/slot bugs for existing callers for free. `layout_create` gains an optional
`root` tree parameter (recursive zod schema); when supplied it takes precedence over the flat path.

## Files

- `src/templates/layout.ts` — rewrite (WidgetNode, alias map, slot inference, FontProperties,
  anonymous block, `generateLayoutTree` + compat `generateLayout`).
- `src/tools/layout-create.ts` — add optional recursive `root` param; keep flat params.
- `tests/templates/layout.test.ts` — NEW.

## Testing

Unit tests (vitest) asserting on generated strings:
1. No `Children` keyword anywhere.
2. Correct slot type per parent (Frame->FrameWidgetSlot, VerticalLayout child->LayoutSlot,
   Overlay child->OverlayWidgetSlot, Scale child->AlignableSlot).
3. Anonymous `{ }` child block present.
4. `FontProperties FontProperties "{...}"` sub-node emitted from `font`.
5. Aliases resolve to `*WidgetClass`.
6. Root has no `Slot`.
7. Flat/back-compat path still generates for each `layoutType` and no longer emits `Children`.
8. Round-trip: generated output parses via `parse()` without throwing (fix parser anonymous-block
   handling if needed; otherwise assert structurally).

## Out of scope (later sub-projects)

UI recipe library, gamemode scaffolding, KB pattern extraction.
