"use client";

import { useState } from "react";
import Link from "next/link";
import { Row, Text } from "@buttergolf/ui";
import { CloseIcon } from "../header/icons";

export function TrustBar() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <Row
      backgroundColor="$background"
      borderBottomWidth={1}
      borderColor="$border"
      paddingVertical="$sm"
      paddingHorizontal="$md"
      justifyContent="center"
      alignItems="center"
      flexWrap="wrap"
      gap="$2"
      {...{
        style: { position: "fixed", top: 0, left: 0, right: 0, zIndex: 100 },
      }}
    >
      <Row alignItems="center" justifyContent="center" flexWrap="wrap" gap="$xs">
        <Text size="$3" weight="medium" color="$text">
          Give 10%, Get 10%.
        </Text>
        <Link href="/refer-a-friend" style={{ textDecoration: "none" }}>
          <Text
            size="$3"
            weight="medium"
            color="$primary"
            textDecorationLine="underline"
            cursor="pointer"
            hoverStyle={{ opacity: 0.7 }}
          >
            Refer a friend.
          </Text>
        </Link>
      </Row>

      {/* Close button */}
      <Row
        position="absolute"
        right="$md"
        tag="button"
        cursor="pointer"
        padding="$1"
        backgroundColor="transparent"
        borderWidth={0}
        hoverStyle={{ opacity: 0.7 }}
        onPress={() => setIsVisible(false)}
        aria-label="Dismiss"
      >
        <CloseIcon />
      </Row>
    </Row>
  );
}
