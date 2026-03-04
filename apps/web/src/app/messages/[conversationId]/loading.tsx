"use client";

import { Column, Row, View } from "@buttergolf/ui";

function Pulse({
  width,
  height,
  borderRadius = "$sm",
}: {
  width: number | `${number}%`;
  height: number;
  borderRadius?: string;
}) {
  return (
    <View
      width={width}
      height={height}
      borderRadius={borderRadius as unknown as number}
      backgroundColor="$border"
      opacity={0.6}
      animation="lazy"
      enterStyle={{ opacity: 0.3 }}
    />
  );
}

export default function MessageThreadLoading() {
  return (
    <Column height="100%" width="100%">
      {/* Header skeleton */}
      <Row
        gap="$md"
        paddingHorizontal="$lg"
        paddingVertical="$md"
        borderBottomWidth={1}
        borderBottomColor="$border"
        alignItems="center"
      >
        <Pulse width={40} height={40} borderRadius="$full" />
        <Column gap={4}>
          <Pulse width={120} height={14} />
          <Pulse width={160} height={12} />
        </Column>
      </Row>

      {/* Message area skeleton */}
      <Column flex={1} padding="$lg" gap="$lg">
        {/* Other user message (left) */}
        <Row gap="$sm" alignItems="flex-end">
          <Pulse width={28} height={28} borderRadius="$full" />
          <Pulse width={200} height={48} borderRadius="$md" />
        </Row>

        {/* Own message (right) */}
        <Row gap="$sm" alignItems="flex-end" justifyContent="flex-end">
          <Pulse width={180} height={36} borderRadius="$md" />
        </Row>

        {/* Other user message (left) */}
        <Row gap="$sm" alignItems="flex-end">
          <Pulse width={28} height={28} borderRadius="$full" />
          <Pulse width={240} height={60} borderRadius="$md" />
        </Row>

        {/* Own message (right) */}
        <Row gap="$sm" alignItems="flex-end" justifyContent="flex-end">
          <Pulse width={160} height={36} borderRadius="$md" />
        </Row>
      </Column>

      {/* Input area skeleton */}
      <Row
        paddingHorizontal="$lg"
        paddingVertical="$md"
        borderTopWidth={1}
        borderTopColor="$border"
        gap="$sm"
        alignItems="center"
      >
        <Pulse width="85%" height={40} borderRadius="$full" />
        <Pulse width={40} height={40} borderRadius="$full" />
      </Row>
    </Column>
  );
}
