"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Column, Text, Heading, Button } from "@buttergolf/ui";

export default function GlobalError({
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
    <html lang="en">
      <body>
        <Column padding="$2xl" maxWidth={600} marginHorizontal="auto" marginVertical={0} gap="$lg">
          <Heading level={2} size="$8" color="$text">
            Something went wrong!
          </Heading>

          <Text size="$5" color="$textSecondary">
            {error?.message || "An unexpected error occurred"}
          </Text>

          <Button butterVariant="primary" size="$5" onPress={() => reset()}>
            Try again
          </Button>
        </Column>
      </body>
    </html>
  );
}
