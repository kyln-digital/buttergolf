"use client";

import { Column, Row } from "@buttergolf/ui";
import { View } from "tamagui";

function SkeletonPulse({
  width,
  height,
  borderRadius = "$sm",
}: {
  width: number | string;
  height: number;
  borderRadius?: string;
}) {
  return (
    <View
      width={width}
      height={height}
      borderRadius={borderRadius as any}
      backgroundColor="$border"
      opacity={0.6}
      animation="lazy"
      enterStyle={{ opacity: 0.3 }}
    />
  );
}

function SkeletonItem() {
  return (
    <Row gap="$md" paddingHorizontal="$lg" paddingVertical="$md" alignItems="center">
      {/* Avatar skeleton */}
      <SkeletonPulse width={48} height={48} borderRadius="$full" />

      {/* Content skeleton */}
      <Column flex={1} gap={6}>
        <Row justifyContent="space-between" alignItems="center">
          <SkeletonPulse width={120} height={14} />
          <SkeletonPulse width={40} height={10} />
        </Row>
        <SkeletonPulse width={160} height={12} />
        <SkeletonPulse width="80%" height={12} />
      </Column>
    </Row>
  );
}

export function ThreadListSkeleton() {
  return (
    <Column height="100%">
      {/* Header skeleton */}
      <Column
        paddingHorizontal="$lg"
        paddingVertical="$md"
        borderBottomWidth={1}
        borderBottomColor="$border"
      >
        <SkeletonPulse width={120} height={24} />
      </Column>

      {/* List skeleton */}
      <Column>
        <SkeletonItem />
        <SkeletonItem />
        <SkeletonItem />
        <SkeletonItem />
        <SkeletonItem />
      </Column>
    </Column>
  );
}
