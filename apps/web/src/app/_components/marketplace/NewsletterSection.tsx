"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "@tamagui/lucide-icons";
import { Button, Column, Input, Row, Spinner, Text, View } from "@buttergolf/ui";

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

  return (
    <Column paddingVertical="$10" backgroundColor="$background">
      <Column
        maxWidth={800}
        marginHorizontal="auto"
        paddingHorizontal="$4"
        width="100%"
        gap="$lg"
        alignItems="center"
      >
        <Column gap="$sm" alignItems="center">
          <Text size="$8" weight="bold" color="$text" textAlign="center">
            Don&apos;t miss deals
          </Text>
          <Text color="$textSecondary" size="$5" textAlign="center">
            Get the latest listings and price drops in your inbox
          </Text>
        </Column>

        <>
          <Row
            gap="$md"
            maxWidth={500}
            width="100%"
            alignItems="center"
            $sm={{ flexDirection: "column" }}
            $md={{ flexDirection: "row" }}
          >
            <Input
              flex={1}
              size="lg"
              placeholder="you@example.com"
              borderRadius="$full"
              paddingHorizontal="$4"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (status === "error" || status === "success" || status === "successTick") {
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
              disabled={status === "submitting" || status === "success" || status === "successTick"}
            />
            <Button
              butterVariant="primary"
              size="$5"
              animation="medium"
              flexShrink={0}
              paddingHorizontal={status === "successTick" ? "$3" : "$6"}
              minWidth={status === "successTick" ? 56 : 170}
              $sm={{ width: "100%" }}
              $md={{ width: "auto" }}
              onPress={() => {
                void handleSubscribe();
              }}
              disabled={status === "submitting" || status === "success" || status === "successTick"}
            >
              {status === "submitting" ? (
                <Row alignItems="center" justifyContent="center" gap="$sm" width="100%">
                  <Spinner size="sm" color="$white" alignSelf="center" />
                  <Text size="$5" color="$white" weight="bold">
                    Subscribing...
                  </Text>
                </Row>
              ) : (
                <Row alignItems="center" justifyContent="center" gap="$sm">
                  <View
                    animation="bouncy"
                    opacity={status === "success" || status === "successTick" ? 1 : 0}
                    scale={status === "success" || status === "successTick" ? 1 : 0.5}
                    width={status === "success" || status === "successTick" ? 18 : 0}
                    overflow="hidden"
                  >
                    <Check size={18} color="$white" />
                  </View>
                  <Text
                    size="$5"
                    color="$white"
                    weight="bold"
                    animation="quick"
                    opacity={status === "successTick" ? 0 : 1}
                    x={status === "successTick" ? 8 : 0}
                  >
                    {status === "success" ? "Subscribed" : "Subscribe"}
                  </Text>
                </Row>
              )}
            </Button>
          </Row>

          {status === "success" && message ? (
            <Text size="$4" color="$textSecondary" textAlign="center" maxWidth={500} width="100%">
              {message}
            </Text>
          ) : null}

          {status === "error" && message ? (
            <Text size="$4" color="$error" textAlign="center" maxWidth={500} width="100%">
              {message}
            </Text>
          ) : null}
        </>
      </Column>
    </Column>
  );
}
