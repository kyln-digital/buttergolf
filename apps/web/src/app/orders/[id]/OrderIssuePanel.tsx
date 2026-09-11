"use client";

import { useState } from "react";
import {
  Button,
  Column,
  Heading,
  Label,
  Radio,
  RadioGroup,
  RadioIndicator,
  Row,
  Sheet,
  Text,
  TextArea,
  View,
} from "@buttergolf/ui";
import { AlertCircle, CheckCircle, Flag, X } from "@tamagui/lucide-icons";
import {
  canOpenIssue,
  ISSUE_DESCRIPTION_MAX,
  ISSUE_DESCRIPTION_MIN,
  ISSUE_REASON_LABELS,
  type IssueHoldStatus,
  type IssueOrderStatus,
  type IssueReason,
} from "@/lib/order-issue-state";

export interface OrderIssueSummary {
  id: string;
  reason: string;
  description: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
  resolution: "REFUNDED" | "RELEASED" | "DISMISSED" | null;
  resolutionNote: string | null;
  createdAt: Date | string;
  resolvedAt: Date | string | null;
}

interface OrderIssuePanelProps {
  orderId: string;
  userRole: "buyer" | "seller";
  status: IssueOrderStatus;
  paymentHoldStatus: IssueHoldStatus;
  issue: OrderIssueSummary | null;
  onIssueCreated: (issue: OrderIssueSummary) => void;
}

const REASON_OPTIONS = Object.entries(ISSUE_REASON_LABELS) as [IssueReason, string][];

function reasonLabel(reason: string): string {
  return reason in ISSUE_REASON_LABELS ? ISSUE_REASON_LABELS[reason as IssueReason] : reason;
}

function statusLine(issue: OrderIssueSummary, userRole: "buyer" | "seller"): string {
  if (issue.status === "OPEN") {
    return userRole === "buyer"
      ? "Our team will review it and be in touch. The seller's payout is on hold until it's resolved."
      : "ButterGolf support is reviewing this. Your payout is on hold until it's resolved. You can reply to the buyer in the order conversation.";
  }
  if (issue.status === "UNDER_REVIEW") {
    return "ButterGolf support is looking into this now.";
  }
  switch (issue.resolution) {
    case "REFUNDED":
      return userRole === "buyer"
        ? "Resolved: your payment has been refunded."
        : "Resolved: the buyer was refunded. No payout will be made for this order.";
    case "RELEASED":
      return userRole === "buyer"
        ? "Resolved: after review, the payment was released to the seller."
        : "Resolved: your payout has been released.";
    case "DISMISSED":
      return "Resolved: closed without further action. The order continues as normal.";
    default:
      return "Resolved.";
  }
}

/**
 * "Report a problem" for the buyer, and the state of a reported problem for
 * both parties. Lives inside the order page's payment card.
 */
export function OrderIssuePanel({
  orderId,
  userRole,
  status,
  paymentHoldStatus,
  issue,
  onIssueCreated,
}: OrderIssuePanelProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<IssueReason | "">("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (issue) {
    const resolved = issue.status === "RESOLVED";
    return (
      <View
        backgroundColor={resolved ? "$successLight" : "$errorLight"}
        borderRadius="$md"
        padding="$md"
        borderLeftWidth={4}
        borderLeftColor={resolved ? "$success" : "$error"}
      >
        <Column gap="$xs">
          <Row gap="$sm" alignItems="center">
            {resolved ? (
              <CheckCircle size={18} color="$success" />
            ) : (
              <AlertCircle size={18} color="$error" />
            )}
            <Text fontWeight="600" color={resolved ? "$success" : "$error"}>
              Problem reported: {reasonLabel(issue.reason)}
            </Text>
          </Row>
          <Text size="$4" color="$textSecondary">
            {statusLine(issue, userRole)}
          </Text>
          {resolved && issue.resolutionNote && (
            <Text size="$4" color="$text">
              Note from our team: {issue.resolutionNote}
            </Text>
          )}
        </Column>
      </View>
    );
  }

  if (userRole !== "buyer") return null;

  const eligibility = canOpenIssue({ status, paymentHoldStatus, hasIssue: false });

  if (eligibility.allowed === false) {
    if (eligibility.reason === "ALREADY_RELEASED") {
      return (
        <Text size="$3" color="$textSecondary">
          Problem with this order? Email support@buttergolf.com and we&apos;ll help.
        </Text>
      );
    }
    return null;
  }

  const trimmedLength = description.trim().length;
  const canSubmit = reason !== "" && trimmedLength >= ISSUE_DESCRIPTION_MIN && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, description: description.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Failed to report the problem");
      }
      onIssueCreated(data.issue as OrderIssueSummary);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to report the problem");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Row gap="$md" alignItems="center" justifyContent="space-between" flexWrap="wrap">
        <Text size="$4" color="$textSecondary">
          Something wrong with this order?
        </Text>
        <Button
          butterVariant="ghost"
          size="$4"
          icon={<Flag size={16} color="$text" />}
          onPress={() => setOpen(true)}
        >
          Report a problem
        </Button>
      </Row>

      <Sheet
        modal
        open={open}
        onOpenChange={setOpen}
        snapPoints={[90]}
        dismissOnSnapToBottom
        zIndex={100_000}
        animation="medium"
      >
        <Sheet.Overlay
          animation="lazy"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          backgroundColor="$overlayDark50"
        />
        <Sheet.Handle backgroundColor="$border" />
        <Sheet.Frame
          backgroundColor="$background"
          borderTopLeftRadius="$2xl"
          borderTopRightRadius="$2xl"
          paddingBottom="$xl"
        >
          <Sheet.ScrollView>
            <Column gap="$lg" padding="$lg" maxWidth={640} width="100%" alignSelf="center">
              <Row alignItems="center" justifyContent="space-between">
                <Heading level={2} size="$7">
                  Report a problem
                </Heading>
                <Button
                  butterVariant="icon"
                  size="$3"
                  circular
                  icon={<X size={18} />}
                  onPress={() => setOpen(false)}
                  aria-label="Close"
                />
              </Row>

              <Text size="$4" color="$textSecondary">
                Tell us what went wrong. The seller&apos;s payout stays on hold while our team
                reviews it, and we&apos;ll email you with the outcome.
              </Text>

              <Column gap="$sm">
                <Text fontWeight="600">What happened?</Text>
                <RadioGroup
                  value={reason}
                  onValueChange={(value) => setReason(value as IssueReason)}
                  gap={0}
                  aria-label="Reason"
                >
                  {REASON_OPTIONS.map(([value, label]) => {
                    const radioId = `issue-reason-${value}`;
                    return (
                      <Row key={value} alignItems="center" gap="$sm" minHeight={36}>
                        <Radio id={radioId} value={value} size="sm">
                          <RadioIndicator />
                        </Radio>
                        <Label
                          htmlFor={radioId}
                          size="$4"
                          marginBottom={0}
                          cursor="pointer"
                          color="$text"
                          fontWeight={reason === value ? "600" : "400"}
                        >
                          {label}
                        </Label>
                      </Row>
                    );
                  })}
                </RadioGroup>
              </Column>

              <Column gap="$sm">
                <Text fontWeight="600">Describe the problem</Text>
                <TextArea
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What did you receive, and how does it differ from the listing? Photos can be sent to the seller in the order conversation."
                  numberOfLines={6}
                  maxLength={ISSUE_DESCRIPTION_MAX}
                />
                <Text size="$3" color="$textSecondary">
                  {trimmedLength < ISSUE_DESCRIPTION_MIN
                    ? `At least ${ISSUE_DESCRIPTION_MIN} characters (${trimmedLength}/${ISSUE_DESCRIPTION_MIN})`
                    : `${trimmedLength}/${ISSUE_DESCRIPTION_MAX}`}
                </Text>
              </Column>

              {error && (
                <View backgroundColor="$errorLight" borderRadius="$md" padding="$md">
                  <Text color="$error" size="$4">
                    {error}
                  </Text>
                </View>
              )}

              <Button
                butterVariant="primary"
                size="$5"
                width="100%"
                onPress={handleSubmit}
                disabled={!canSubmit}
                opacity={canSubmit ? 1 : 0.6}
              >
                {submitting ? "Sending..." : "Send report"}
              </Button>
            </Column>
          </Sheet.ScrollView>
        </Sheet.Frame>
      </Sheet>
    </>
  );
}
