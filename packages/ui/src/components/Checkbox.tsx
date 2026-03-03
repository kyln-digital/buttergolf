"use client";

import { styled, GetProps, YStack } from "tamagui";
import { useState } from "react";

// Visible checkbox box
const CheckboxBox = styled(YStack, {
  name: "CheckboxBox",
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
  transition: "fast",

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleChange();
    }
  };

  return (
    <CheckboxBox
      checked={checked}
      disabled={disabled}
      size={size}
      onPress={handleChange}
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      {...({ onKeyDown: handleKeyDown } as {
        onKeyDown: React.KeyboardEventHandler;
      })}
    >
      {/* Hidden input for form integration */}
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => {}}
        id={id}
        name={name}
        value={value}
        tabIndex={-1}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
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
  );
}

export type CheckboxProps_2 = GetProps<typeof Checkbox>;
