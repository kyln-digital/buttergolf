"use client";

import { Column, Row, Text, Checkbox } from "@buttergolf/ui";

const CONDITIONS = [
  { value: "NEW", label: "New" },
  { value: "LIKE_NEW", label: "Like New" },
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
  const handleToggle = (condition: string) => {
    if (selectedConditions.includes(condition)) {
      onChange(selectedConditions.filter((c) => c !== condition));
    } else {
      onChange([...selectedConditions, condition]);
    }
  };

  return (
    <Column gap="$xs">
      {CONDITIONS.map((condition) => (
        <Row
          key={condition.value}
          gap="$sm"
          alignItems="center"
          paddingVertical="$xs"
          cursor="pointer"
          onClick={() => handleToggle(condition.value)}
        >
          <Checkbox
            checked={selectedConditions.includes(condition.value)}
            onChange={() => handleToggle(condition.value)}
            size="sm"
          />
          <Text size="$3">{condition.label}</Text>
        </Row>
      ))}
    </Column>
  );
}
