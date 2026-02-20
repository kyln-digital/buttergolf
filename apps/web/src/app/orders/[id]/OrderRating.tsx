"use client";

import { useState, useEffect } from "react";
import { Card, Column, Row, Text, TextArea, Button, Heading, Badge } from "@buttergolf/ui";
import { RATING_LIMITS } from "@/lib/constants";
import { formatDate } from "@/lib/utils/format";

interface Rating {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface OrderRatingProps {
  orderId: string;
  isDelivered: boolean;
  isBuyer: boolean;
  sellerName: string;
}

/**
 * Get rating label for a given score
 */
function getRatingLabel(rating: number): string {
  const labels = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];
  return labels[rating] || "";
}

export function OrderRating({ orderId, isDelivered, isBuyer, sellerName }: OrderRatingProps) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [canRate, setCanRate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    const fetchRating = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}/rating`);
        if (response.ok) {
          const data = await response.json();
          setRating(data.rating);
          setCanRate(data.canRate);
        }
      } catch (err) {
        console.error("Failed to fetch rating:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRating();
  }, [orderId]);

  const handleSubmit = async () => {
    if (selectedRating === 0) {
      setError("Please select a rating");
      return;
    }

    if (comment.length > RATING_LIMITS.COMMENT_MAX_LENGTH) {
      setError("Comment is too long");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: selectedRating,
          comment: comment.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit rating");
      }

      const data = await response.json();
      setRating(data.rating);
      setCanRate(false);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  const isOverLimit = comment.length > RATING_LIMITS.COMMENT_MAX_LENGTH;
  const displayRating = hoverRating || selectedRating;

  // Don't show anything while loading or if not delivered
  if (loading || !isDelivered) {
    return null;
  }

  // Show existing rating (read-only)
  if (rating) {
    return (
      <Card variant="elevated" padding="$lg">
        <Card.Header noBorder>
          <Heading level={2} size="$7">
            Seller Rating
          </Heading>
        </Card.Header>
        <Card.Body>
          <Row alignItems="center" gap="$md" marginBottom="$md">
            {[1, 2, 3, 4, 5].map((star) => (
              <Text
                key={star}
                size="$10"
                color={star <= rating.rating ? "$warning" : "$textTertiary"}
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
              >
                ★
              </Text>
            ))}
            <Text size="$6" fontWeight="600">
              {rating.rating}/5
            </Text>
          </Row>
          {rating.comment && (
            <Text size="$4" color="$textSecondary" marginTop="$md">
              &quot;{rating.comment}&quot;
            </Text>
          )}
          <Text size="$3" color="$textTertiary" marginTop="$sm">
            Rated on {formatDate(rating.createdAt)}
          </Text>
        </Card.Body>
      </Card>
    );
  }

  // Don't show rating form if not buyer or can't rate
  if (!isBuyer || !canRate) {
    return null;
  }

  // Success state after submission
  if (success) {
    return (
      <Card variant="elevated" backgroundColor="$successLight" padding="$lg">
        <Column gap="$md" alignItems="center">
          <Badge variant="success" size="lg">
            Thank You!
          </Badge>
          <Heading level={2} size="$7" color="$success" textAlign="center">
            Your rating has been submitted
          </Heading>
          <Text size="$4" color="$textSecondary" textAlign="center">
            Thanks for helping build trust in our marketplace!
          </Text>
        </Column>
      </Card>
    );
  }

  // Interactive rating form
  return (
    <Card variant="elevated" padding="$lg">
      <Card.Header noBorder>
        <Heading level={2} size="$7">
          Rate Your Experience
        </Heading>
        <Text size="$4" color="$textSecondary" marginTop="$sm">
          How was your experience with {sellerName || "this seller"}?
        </Text>
      </Card.Header>

      <Card.Body>
        <Column gap="$lg">
          {/* Star Rating */}
          <Column gap="$sm">
            <Row alignItems="center" gap="$sm">
              {[1, 2, 3, 4, 5].map((star) => (
                <Button
                  key={star}
                  chromeless
                  onPress={() => setSelectedRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  pressStyle={{ scale: 1.1 }}
                  hoverStyle={{ scale: 1.05 }}
                  aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                  size="$8"
                  padding="$1"
                >
                  <Text
                    size="$10"
                    color={star <= displayRating ? "$warning" : "$borderPress"}
                    style={{
                      transition: "all 0.2s ease",
                    }}
                  >
                    ★
                  </Text>
                </Button>
              ))}
            </Row>
            {selectedRating > 0 && (
              <Text size="$4" color="$textSecondary" fontWeight="500">
                {getRatingLabel(selectedRating)}
              </Text>
            )}
          </Column>

          {/* Comment */}
          <Column gap="$sm">
            <Text size="$4" fontWeight="600">
              Tell us more (optional)
            </Text>
            <TextArea
              value={comment}
              onChangeText={setComment}
              placeholder="Share your experience with other buyers..."
              size="md"
              rows={4}
              maxLength={RATING_LIMITS.COMMENT_MAX_LENGTH + 100} // Allow typing over but show error
              error={isOverLimit}
              aria-label="Rating comment"
              disabled={submitting}
            />
            <Row justifyContent="space-between" alignItems="center">
              <Text size="$2" color={isOverLimit ? "$error" : "$textTertiary"}>
                {comment.length}/{RATING_LIMITS.COMMENT_MAX_LENGTH}
              </Text>
              {isOverLimit && (
                <Badge variant="error" size="sm">
                  Over limit
                </Badge>
              )}
            </Row>
          </Column>

          {/* Error */}
          {error && (
            <Row alignItems="center" gap="$sm">
              <Badge variant="error">Error</Badge>
              <Text size="$3" color="$error">
                {error}
              </Text>
            </Row>
          )}
        </Column>
      </Card.Body>

      <Card.Footer align="right">
        <Button
          butterVariant="primary"
          size="$5"
          onPress={handleSubmit}
          disabled={submitting || selectedRating === 0 || isOverLimit}
          aria-label="Submit rating"
        >
          {submitting ? "Submitting..." : "Submit Rating"}
        </Button>
      </Card.Footer>
    </Card>
  );
}
