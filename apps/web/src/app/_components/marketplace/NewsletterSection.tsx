"use client";

import { useState } from "react";
import { Button, Column, Input, Row, Text } from "@buttergolf/ui";

type SubscribeStatus = "idle" | "submitting" | "success" | "error";

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubscribeStatus>("idle");
  const [message, setMessage] = useState("");

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
      setStatus("success");
      setMessage("You have successfully been subscribed.");
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

        {status === "success" ? (
          <Column
            maxWidth={500}
            width="100%"
            alignItems="center"
            gap="$sm"
            backgroundColor="$success"
            borderRadius="$lg"
            padding="$lg"
          >
            <Text size="$6" weight="semibold" color="$textInverse" textAlign="center">
              Subscribed
            </Text>
            <Text size="$5" color="$textInverse" textAlign="center">
              {message}
            </Text>
          </Column>
        ) : (
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
                  if (status === "error") {
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
                disabled={status === "submitting"}
              />
              <Button
                butterVariant="primary"
                size="$5"
                flexShrink={0}
                paddingHorizontal="$6"
                $sm={{ width: "100%" }}
                $md={{ width: "auto" }}
                onPress={() => {
                  void handleSubscribe();
                }}
                disabled={status === "submitting"}
              >
                {status === "submitting" ? "Subscribing..." : "Subscribe"}
              </Button>
            </Row>

            {status === "error" && message ? (
              <Text size="$4" color="$error" textAlign="center" maxWidth={500} width="100%">
                {message}
              </Text>
            ) : null}
          </>
        )}
      </Column>
    </Column>
  );
}
