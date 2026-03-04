# Popover Animation Notes (Tamagui)

## Problem

Animating `Popover.Content` directly with Tamagui `enterStyle` / `exitStyle` can cause the panel to appear "stuck" in an invisible state in this project setup.

Observed symptoms:

- Popover lifecycle events fire (`onOpenChange` reports open).
- Popover node mounts in the DOM.
- Computed styles can remain:
  - `opacity: 0`
  - `pointer-events: none`

This makes it look like the trigger is broken, when the panel is actually mounted but invisible.

## Root Cause (practical)

`Popover.Content` is handling floating/portal/interactive visibility behavior. Applying Tamagui entry/exit animation props on that same container has proven unreliable here.

## Working Pattern

1. Keep `Popover.Content` unanimated by Tamagui enter/exit props.
2. Use Tamagui Popover behavior props as normal (`allowFlip`, `stayInFrame`, `offset`, `resize`, etc.).
3. For panel animation on web, use CSS keyframes on the popover element (or animate safe inner wrappers).
4. Respect `prefers-reduced-motion`.

## Current Implementation

File: `apps/web/src/app/products/[id]/_components/ProductInformation.tsx`

- Popover remains Tamagui-based.
- Entry animation is done via CSS keyframes (`offerPopoverEnter`) on the popover panel.
- Motion direction: down-and-in (`translateY(-18px) scale(0.92)` to `translateY(0) scale(1)`).

## Do / Don't

Do:

- Do use Tamagui Popover primitives for behavior and positioning.
- Do animate via CSS keyframes on web when entry reliability is required.

Don't:

- Don't put Tamagui `enterStyle` / `exitStyle` directly on `Popover.Content` in this codepath.

## If This Regresses

- Confirm popover opens (`onOpenChange` true).
- Check computed styles on the content node.
- If it is mounted but invisible (`opacity: 0` + `pointer-events: none`), remove container-level Tamagui enter/exit animation and use the working pattern above.

## Dev Warning: `Unexpected text node` in `<Column>`

### Symptom

In dev, console repeatedly logs:

- `Unexpected text node: . A text node cannot be a child of a <Column>.`

### Root Cause

Using `&&` with a string state can produce an empty string child:

- `offerError && <Text>...</Text>`

When `offerError === ""`, React evaluates the expression to `""` (a text node), not `null`.
Tamagui `Column` (View-like) rejects raw text-node children, so it warns.

### Fix Pattern

Use an explicit ternary so the false branch is `null`:

```tsx
{
  offerError ? (
    <Text size="$2" color="$error">
      {offerError}
    </Text>
  ) : null;
}
```

Avoid this pattern for string-based state in non-Text containers:

```tsx
{
  offerError && <Text>{offerError}</Text>;
}
```

### Notes

- This warning is unrelated to the Next.js `global-error.css` preload message.
- The `global-error.css` preload message is usually benign dev noise.
