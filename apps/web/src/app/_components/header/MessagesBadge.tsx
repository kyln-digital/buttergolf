"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "@tamagui/lucide-icons";
import { Row, Text, Button } from "@buttergolf/ui";

const POLL_INTERVAL = 30_000; // 30 seconds

export function MessagesBadge() {
  const router = useRouter();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/unread-count");
      if (res.ok) {
        const data = await res.json();
        setCount(data.count ?? 0);
      }
    } catch {
      // Silently ignore — badge is non-critical
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchCount]);

  return (
    <Button
      chromeless
      circular
      size="$4"
      onPress={() => router.push("/messages")}
      aria-label={count > 0 ? `${count} unread messages` : "Messages"}
      color="$text"
      position="relative"
    >
      <MessageCircle size={22} />
      {count > 0 && (
        <Row
          position="absolute"
          top={2}
          right={2}
          backgroundColor="$primary"
          borderRadius="$full"
          minWidth={18}
          height={18}
          alignItems="center"
          justifyContent="center"
          paddingHorizontal={4}
        >
          <Text size="$1" color="$textInverse" weight="bold">
            {count > 99 ? "99+" : count}
          </Text>
        </Row>
      )}
    </Button>
  );
}
