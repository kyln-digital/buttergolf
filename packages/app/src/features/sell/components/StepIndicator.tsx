"use client";

import React from "react";
import { Row, View } from "@buttergolf/ui";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: Readonly<StepIndicatorProps>) {
  // Helper to get opacity based on step state
  const getOpacity = (stepNumber: number) => {
    if (stepNumber === currentStep) return 1;
    if (stepNumber < currentStep) return 0.7;
    return 0.4;
  };

  return (
    <Row paddingHorizontal="$4" paddingVertical="$3" gap="$2" backgroundColor="$pureWhite">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNumber = i + 1;
        const isActiveOrCompleted = stepNumber <= currentStep;

        return (
          <View
            key={stepNumber}
            flex={1}
            height={4}
            borderRadius="$full"
            backgroundColor={isActiveOrCompleted ? "$spicedClementine" : "$cloudMist"}
            opacity={getOpacity(stepNumber)}
          />
        );
      })}
    </Row>
  );
}
