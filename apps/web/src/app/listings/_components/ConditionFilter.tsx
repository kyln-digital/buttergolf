"use client";

import { useId } from "react";
import { Column, Row, Label, Checkbox } from "@buttergolf/ui";

const CONDITIONS = [
  { value: "NEW", label: "New" },
  { value: "LIKE_NEW", label: "Like new" },
  { value: "EXCELLENT", label: "Excellent" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
];

interface ConditionFilterProps {
  selectedConditions: string[];
  onChange: (conditions: string[]) => void;
}

export function ConditionFilter({ selectedConditions, onChange }: Readonly<ConditionFilterProps>) {
  const idPrefix = useId();

  const handleToggle = (condition: string) => {
    if (selectedConditions.includes(condition)) {
      onChange(selectedConditions.filter((c) => c !== condition));
    } else {
      onChange([...selectedConditions, condition]);
    }
  };

  return (
    <Column>
      {CONDITIONS.map((condition) => {
        const checkboxId = `${idPrefix}-${condition.value}`;
        return (
          <Row key={condition.value} gap="$sm" alignItems="center" minHeight={36}>
            <Checkbox
              id={checkboxId}
              checked={selectedConditions.includes(condition.value)}
              onChange={() => handleToggle(condition.value)}
              size="sm"
            />
            {/* htmlFor points at the checkbox button, so the label click toggles it natively. */}
            <Label
              htmlFor={checkboxId}
              size="$4"
              fontWeight="400"
              marginBottom={0}
              cursor="pointer"
            >
              {condition.label}
            </Label>
          </Row>
        );
      })}
    </Column>
  );
}
