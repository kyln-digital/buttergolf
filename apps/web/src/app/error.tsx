"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Column, Text, Heading, Button } from "@buttergolf/ui";

export default function Error({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <Column gap="$lg" alignItems="center" justifyContent="center" padding="$xl" minHeight="60vh">
      <Heading level={2}>Something went wrong</Heading>
      <Text color="$textSecondary">
        An unexpected error occurred. Please try again, or come back shortly.
      </Text>
      <Button size="$5" backgroundColor="$primary" color="$textInverse" onPress={() => reset()}>
        Try again
      </Button>
    </Column>
  );
}
