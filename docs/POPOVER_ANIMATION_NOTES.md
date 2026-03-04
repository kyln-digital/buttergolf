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
