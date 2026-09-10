"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "@tamagui/lucide-icons";
import { Button, Column, Input, Row, Spinner, Text, View } from "@buttergolf/ui";
import { Section, SectionHeader } from "./Section";

type SubscribeStatus = "idle" | "submitting" | "successTick" | "success" | "error";

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubscribeStatus>("idle");
  const [message, setMessage] = useState("");
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const handleSubscribe = async () => {
    const normalisedEmail = email.trim().toLowerCase();

    if (!normalisedEmail) {
      setStatus("error");
      setMessage("Please enter your email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalisedEmail)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalisedEmail, source: "homepage" }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }

      setEmail("");
      setStatus("successTick");
      setMessage("You have successfully been subscribed.");

      successTimerRef.current = setTimeout(() => {
        setStatus("success");
      }, 550);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Something went wrong. Please try again."
      );
    }
  };

  const isBusy = status === "submitting" || status === "success" || status === "successTick";
  const showTick = status === "success" || status === "successTick";

  return (
    <Section label="Newsletter">
      <SectionHeader
        title="Don't miss deals"
        subtitle="Get the latest listings and price drops in your inbox"
      />

      <Column alignItems="center" gap="$sm" width="100%">
        <Column
          width="100%"
          maxWidth={560}
          gap="$sm"
          $gtSm={{ flexDirection: "row", alignItems: "center", gap: "$md" }}
        >
          <Input
            flex={1}
            width="100%"
            size="lg"
            placeholder="you@example.com"
            aria-label="Email address"
            inputMode="email"
            autoComplete="email"
            borderRadius="$full"
            paddingHorizontal="$lg"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (status !== "idle" && status !== "submitting") {
                setStatus("idle");
                setMessage("");
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && status !== "submitting") {
                event.preventDefault();
                void handleSubscribe();
              }
            }}
            disabled={isBusy}
          />
          <Button
            butterVariant="primary"
            size="$5"
            width="100%"
            minWidth={150}
            flexShrink={0}
            $gtSm={{ width: "auto" }}
            onPress={() => {
              void handleSubscribe();
            }}
            disabled={isBusy}
          >
            {status === "submitting" ? (
              <Row alignItems="center" justifyContent="center" gap="$sm">
                <Spinner size="sm" color="$white" />
                <Text size="$6" color="$white" fontWeight="600">
                  Subscribing...
                </Text>
              </Row>
            ) : (
              <Row alignItems="center" justifyContent="center" gap="$sm">
                <View
                  animation="bouncy"
                  opacity={showTick ? 1 : 0}
                  scale={showTick ? 1 : 0.5}
                  width={showTick ? 18 : 0}
                  overflow="hidden"
                >
                  <Check size={18} color="$white" />
                </View>
                <Text size="$6" color="$white" fontWeight="600">
                  {status === "success" ? "Subscribed" : "Subscribe"}
                </Text>
              </Row>
            )}
          </Button>
        </Column>

        {status === "success" && message ? (
          <Text size="$4" color="$textSecondary" textAlign="center" role="status">
            {message}
          </Text>
        ) : null}

        {status === "error" && message ? (
          <Text size="$4" color="$error" textAlign="center" role="alert">
            {message}
          </Text>
        ) : null}
      </Column>
    </Section>
  );
}
