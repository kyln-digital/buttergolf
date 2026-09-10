"use client";

import { styled, GetProps, YStack } from "tamagui";
import { useState } from "react";

// Visible checkbox box - a real <button role="checkbox"> so a <label htmlFor>
// activates it natively and Enter / Space toggle it without custom key handling.
const CheckboxBox = styled(YStack, {
  name: "CheckboxBox",
  tag: "button" as const,
  width: 20,
  height: 20,
  borderWidth: 2,
  borderColor: "$fieldBorder",
  borderRadius: "$xs",
  backgroundColor: "$surface",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s ease",

  hoverStyle: {
    borderColor: "$fieldBorderHover",
  },

  focusStyle: {
    borderColor: "$primary",
    borderWidth: 2,
  },

  variants: {
    checked: {
      true: {
        backgroundColor: "$primary",
        borderColor: "$primary",
      },
    },

    disabled: {
      true: {
        opacity: 0.5,
        cursor: "not-allowed",
      },
    },

    size: {
      sm: {
        width: 16,
        height: 16,
      },
      md: {
        width: 20,
        height: 20,
      },
      lg: {
        width: 24,
        height: 24,
      },
    },
  } as const,

  defaultVariants: {
    size: "md",
  },
});

// Checkmark icon sizes
const checkmarkSizes = {
  sm: 10,
  md: 12,
  lg: 14,
} as const;

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  id?: string;
  name?: string;
  value?: string;
  /** Accessible name for the control (use one of these or a visible label). */
  "aria-label"?: string;
  /** Id of the element that labels the control. */
  "aria-labelledby"?: string;
}

export function Checkbox({
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  disabled = false,
  size = "md",
  id,
  name,
  value,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: CheckboxProps) {
  const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);

  const isControlled = controlledChecked !== undefined;
  const checked = isControlled ? controlledChecked : uncontrolledChecked;

  const handleChange = () => {
    if (disabled) return;

    const newChecked = !checked;

    if (!isControlled) {
      setUncontrolledChecked(newChecked);
    }

    onChange?.(newChecked);
  };

  return (
    <>
      <CheckboxBox
        {...{ type: "button" }}
        id={id}
        role="checkbox"
        checked={checked}
        disabled={disabled}
        size={size}
        onPress={handleChange}
        aria-checked={checked}
        aria-disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
      >
        {checked && (
          <svg
            width={checkmarkSizes[size]}
            height={checkmarkSizes[size]}
            viewBox="0 0 12 12"
            fill="none"
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: "none" }}
          >
            <polyline points="2,6 5,9 10,3" />
          </svg>
        )}
      </CheckboxBox>
      {/* Form participation only: a sibling (never inside the button) that submits with the form */}
      {name ? (
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={() => {}}
          name={name}
          value={value}
          tabIndex={-1}
          aria-hidden
          style={{ display: "none" }}
        />
      ) : null}
    </>
  );
}

export type CheckboxProps_2 = GetProps<typeof Checkbox>;
