# ButterGolf Project Memory

## Tamagui Popover Rules (hard-won)

**Problem**: `Popover.Trigger asChild` silently fails when child is a `styled()` component.
**Fix**: Use plain `Button` imported directly from `"tamagui"` (not `@buttergolf/ui`) as the `asChild` child.

**Problem**: `Popover.Content` with `enterStyle={{ opacity: 0 }}` stays invisible if the CSS animation driver doesn't fire.
**Fix**: Do NOT use `enterStyle`/`exitStyle`/`animation` on `Popover.Content` unless you've confirmed animations work. Start without them.

**Problem**: Controlled mode (`open={state}` on `<Popover>`) doesn't work without a `Popover.Trigger` present — the Floating UI context never initialises, so `open=true` has no visible effect.
**Fix**: Use uncontrolled Popover with `Popover.Trigger asChild`. Use `onOpenChange` for cleanup side effects.

**Working pattern**:

```tsx
import { Button as TamaguiButton } from "tamagui";

<Popover
  placement="top"
  onOpenChange={(open) => {
    if (!open) resetForm();
  }}
>
  <Popover.Trigger asChild>
    <TamaguiButton {...stylingProps}>Trigger label</TamaguiButton>
  </Popover.Trigger>
  <Popover.Content borderWidth={1} borderColor="$border" padding="$4" elevate>
    {/* content — NO enterStyle/exitStyle/animation unless tested */}
    <Popover.Close asChild>
      <TamaguiButton>Cancel</TamaguiButton>
    </Popover.Close>
  </Popover.Content>
</Popover>;
```
