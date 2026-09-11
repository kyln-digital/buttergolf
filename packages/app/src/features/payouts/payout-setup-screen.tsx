"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Card, Column, Heading, Row, Spinner, Text } from "@buttergolf/ui";
import { Banknote, CheckCircle, ChevronLeft, Lock, ShieldCheck } from "@tamagui/lucide-icons";
import {
  formatSortCode,
  validateBankAccountInput,
  validatePayoutDetails,
  type BankAccountTokenInput,
  type PayoutDetailsInput,
  type PayoutStatus,
} from "@buttergolf/constants";
import { isPayoutSetupError, payoutErrorMessage } from "./errors";
import { PayoutField } from "./components/PayoutField";

const STRIPE_AGREEMENT_URL = "https://stripe.com/connect-account/legal/full";
const GENERIC_ERROR = "Something went wrong. Please try again.";

export type PayoutSetupStep =
  | "loading"
  | "details"
  | "bank"
  | "verification"
  | "review"
  | "complete";

export interface PayoutSetupScreenProps {
  /** Status already loaded by the caller. Optional; the screen calls fetchStatus on mount when absent. */
  initialStatus?: PayoutStatus;
  /** Force the starting step (e.g. "bank" for "Change bank account"). Default: derived from status. */
  initialStep?: "details" | "bank";
  fetchStatus: () => Promise<PayoutStatus>;
  submitDetails: (input: PayoutDetailsInput) => Promise<PayoutStatus>;
  /** Platform tokenisation (Stripe.js on web, stripe-react-native on mobile). Resolves to a btok_ id; throws PayoutSetupError with a user-facing message on failure. */
  createBankAccountToken: (input: BankAccountTokenInput) => Promise<string>;
  submitBankAccount: (token: string) => Promise<PayoutStatus>;
  /** Platform verification UI (embedded component on web, WebView on mobile). Rendered when the current step is "verification". Call onDone when the user finishes/exits; the screen then refetches status. */
  renderVerification?: (args: { status: PayoutStatus; onDone: () => void }) => ReactNode;
  /** Where the consent line links. Default "/terms-of-service". */
  termsHref?: string;
  /** Open an external/internal link. Web passes a router push; mobile passes Linking.openURL. */
  onOpenLink?: (href: string) => void;
  onComplete?: (status: PayoutStatus) => void;
  onExit?: () => void;
  /** Show a title bar with a back button (mobile). Default false. */
  showHeader?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveStep(status: PayoutStatus): PayoutSetupStep {
  if (!status.hasAccount || status.needsDetails) return "details";
  if (status.needsBankAccount) return "bank";
  if (status.needsVerification) return "verification";
  if (status.isComplete) return "complete";
  return "review";
}

/** "" and "7a" become NaN so validateDob reports a missing date, not a bad one. */
function toDatePart(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return Number.NaN;
  return Number(trimmed);
}

function digitsOnly(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max);
}

/** Formats while the seller types: "1234" → "12-34", "123456" → "12-34-56". */
function formatSortCodeInput(value: string): string {
  const digits = digitsOnly(value, 6);
  if (digits.length === 6) return formatSortCode(digits);
  const groups: string[] = [];
  for (let index = 0; index < digits.length; index += 2) {
    groups.push(digits.slice(index, index + 2));
  }
  return groups.join("-");
}

/** "individual.address.postal_code" → "Address postal code". */
function humaniseRequirement(requirement: string): string {
  const words = requirement
    .replace(/^individual\./, "")
    .replace(/^company\./, "")
    .replace(/[._]/g, " ")
    .trim();
  if (!words) return requirement;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const BANK_PARAM_FIELDS: ReadonlyArray<[RegExp, keyof BankAccountTokenInput]> = [
  [/routing|sort/i, "sortCode"],
  [/account_number|accountnumber/i, "accountNumber"],
  [/holder/i, "accountHolderName"],
];

function bankFieldForParam(param: string | null | undefined): keyof BankAccountTokenInput | null {
  if (!param) return null;
  for (const [pattern, field] of BANK_PARAM_FIELDS) {
    if (pattern.test(param)) return field;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * ButterGolf's own "Get paid" flow: our details form, then a UK bank account
 * tokenised on the device, with Stripe's embedded component kept in reserve for
 * the identity checks we cannot collect ourselves.
 *
 * Platform-agnostic: every piece of IO arrives as a prop.
 */
export function PayoutSetupScreen({
  initialStatus,
  initialStep,
  fetchStatus,
  submitDetails,
  createBankAccountToken,
  submitBankAccount,
  renderVerification,
  termsHref = "/terms-of-service",
  onOpenLink,
  onComplete,
  onExit,
  showHeader = false,
}: Readonly<PayoutSetupScreenProps>) {
  const [status, setStatus] = useState<PayoutStatus | null>(initialStatus ?? null);
  /** Stripe already holds a date of birth, so the form may leave it blank. */
  const dobOnFile = status?.prefill.hasDob ?? false;
  const [step, setStep] = useState<PayoutSetupStep>(() =>
    initialStatus ? (initialStep ?? deriveStep(initialStatus)) : "loading"
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Details form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [detailsErrors, setDetailsErrors] = useState<Record<string, string>>({});

  // Bank form
  const [accountHolderName, setAccountHolderName] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankErrors, setBankErrors] = useState<Record<string, string>>({});

  const applyStatus = useCallback((next: PayoutStatus, preferredStep?: "details" | "bank") => {
    setStatus(next);
    setStep(preferredStep ?? deriveStep(next));
  }, []);

  const loadStatus = useCallback(
    async (preferredStep?: "details" | "bank") => {
      setRefreshing(true);
      setFormError(null);
      try {
        const next = await fetchStatus();
        applyStatus(next, preferredStep);
      } catch (error) {
        setFormError(payoutErrorMessage(error, "We couldn't load your payout details."));
        setStep((current) => (current === "loading" ? "details" : current));
      } finally {
        setRefreshing(false);
      }
    },
    [applyStatus, fetchStatus]
  );

  // Load on mount when the caller did not hand us a status.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (initialStatus || loadedRef.current) return;
    loadedRef.current = true;
    void loadStatus(initialStep);
  }, [initialStatus, initialStep, loadStatus]);

  // Seed both forms from the prefill the first time a status arrives.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!status || prefilledRef.current) return;
    prefilledRef.current = true;

    const { prefill, bankAccount } = status;
    setFirstName(prefill.firstName ?? "");
    setLastName(prefill.lastName ?? "");
    setPhone(prefill.phone ?? "");
    if (prefill.address) {
      setLine1(prefill.address.line1 ?? "");
      setLine2(prefill.address.line2 ?? "");
      setCity(prefill.address.city ?? "");
      setPostalCode(prefill.address.postalCode ?? "");
    }
    setAccountHolderName(
      bankAccount?.accountHolderName ??
        [prefill.firstName, prefill.lastName].filter(Boolean).join(" ")
    );
  }, [status]);

  const handleFailure = useCallback(
    (error: unknown, setFieldErrors: (errors: Record<string, string>) => void) => {
      if (isPayoutSetupError(error) && error.fieldErrors) {
        const entries = Object.entries(error.fieldErrors);
        if (entries.length > 0) {
          setFieldErrors(Object.fromEntries(entries));
          setFormError(null);
          return;
        }
      }
      setFormError(payoutErrorMessage(error, GENERIC_ERROR));
    },
    []
  );

  const handleDetailsSubmit = useCallback(async () => {
    // Stripe already holding a DOB means the seller can leave it blank and we
    // send nothing for it; anything typed is validated and sent as usual.
    const dobTouched = Boolean(dobDay.trim() || dobMonth.trim() || dobYear.trim());
    const input: PayoutDetailsInput = {
      firstName,
      lastName,
      ...(dobTouched || !dobOnFile
        ? {
            dob: {
              day: toDatePart(dobDay),
              month: toDatePart(dobMonth),
              year: toDatePart(dobYear),
            },
          }
        : {}),
      address: { line1, line2, city, postalCode },
      phone,
    };

    const validation = validatePayoutDetails(input, new Date(), { requireDob: !dobOnFile });
    if (!validation.ok || !validation.value) {
      setDetailsErrors(validation.errors as Record<string, string>);
      setFormError(null);
      return;
    }

    setDetailsErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      const next = await submitDetails(validation.value);
      applyStatus(next);
    } catch (error) {
      handleFailure(error, setDetailsErrors);
    } finally {
      setSubmitting(false);
    }
  }, [
    applyStatus,
    city,
    dobDay,
    dobMonth,
    dobOnFile,
    dobYear,
    firstName,
    handleFailure,
    lastName,
    line1,
    line2,
    phone,
    postalCode,
    submitDetails,
  ]);

  const handleBankSubmit = useCallback(async () => {
    const validation = validateBankAccountInput({ accountHolderName, sortCode, accountNumber });
    if (!validation.ok || !validation.value) {
      setBankErrors(validation.errors as Record<string, string>);
      setFormError(null);
      return;
    }

    setBankErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      const token = await createBankAccountToken(validation.value);
      const next = await submitBankAccount(token);
      applyStatus(next);
    } catch (error) {
      const field = isPayoutSetupError(error) ? bankFieldForParam(error.param) : null;
      if (field) {
        setBankErrors({ [field]: payoutErrorMessage(error, GENERIC_ERROR) });
        setFormError(null);
      } else {
        handleFailure(error, setBankErrors);
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    accountHolderName,
    accountNumber,
    applyStatus,
    createBankAccountToken,
    handleFailure,
    sortCode,
    submitBankAccount,
  ]);

  const busy = submitting || refreshing;

  const errorCard = formError ? (
    <Card variant="outlined" padding="$md" borderColor="$error">
      <Text size="$4" color="$error">
        {formError}
      </Text>
    </Card>
  ) : null;

  const checkAgainButton = (
    <Button
      butterVariant="secondary"
      size="$4"
      onPress={() => void loadStatus()}
      disabled={busy}
      width="100%"
    >
      {refreshing ? "Checking..." : "Check again"}
    </Button>
  );

  // -------------------------------------------------------------------------
  // Steps
  // -------------------------------------------------------------------------

  function renderLoading() {
    if (formError) {
      return (
        <Column gap="$md" alignItems="center" paddingVertical="$2xl">
          {errorCard}
          {checkAgainButton}
        </Column>
      );
    }
    return (
      <Column gap="$md" alignItems="center" justifyContent="center" paddingVertical="$3xl">
        <Spinner size="lg" color="$primary" />
        <Text size="$4" color="$textSecondary">
          Loading your details...
        </Text>
      </Column>
    );
  }

  function renderDetails() {
    return (
      <Column gap="$lg" width="100%">
        <Column gap="$xs">
          <Heading level={3}>Get paid for what you sell</Heading>
          <Text size="$5" color="$textSecondary">
            We need a few details so we can pay you. It takes about a minute and you only do it
            once.
          </Text>
        </Column>

        {errorCard}

        <Column gap="$md">
          <Row gap="$md" flexWrap="wrap">
            <PayoutField
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Jamie"
              autoCapitalize="words"
              autoComplete="given-name"
              error={detailsErrors.firstName}
              disabled={submitting}
              flex={1}
            />
            <PayoutField
              label="Last name"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Sutherland"
              autoCapitalize="words"
              autoComplete="family-name"
              error={detailsErrors.lastName}
              disabled={submitting}
              flex={1}
            />
          </Row>

          <Column gap="$xs">
            <Text size="$3" color="$textSecondary" fontWeight="500">
              Date of birth
            </Text>
            <Row gap="$sm">
              <PayoutField
                label="Day"
                value={dobDay}
                onChangeText={(value) => setDobDay(digitsOnly(value, 2))}
                placeholder="DD"
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={2}
                disabled={submitting}
                flex={1}
              />
              <PayoutField
                label="Month"
                value={dobMonth}
                onChangeText={(value) => setDobMonth(digitsOnly(value, 2))}
                placeholder="MM"
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={2}
                disabled={submitting}
                flex={1}
              />
              <PayoutField
                label="Year"
                value={dobYear}
                onChangeText={(value) => setDobYear(digitsOnly(value, 4))}
                placeholder="YYYY"
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={4}
                disabled={submitting}
                flex={1.4}
              />
            </Row>
            {detailsErrors.dob ? (
              <Text size="$2" color="$error">
                {detailsErrors.dob}
              </Text>
            ) : dobOnFile ? (
              <Text size="$2" color="$textMuted">
                Already on file. Leave blank to keep it.
              </Text>
            ) : null}
          </Column>

          <PayoutField
            label="Address line 1"
            value={line1}
            onChangeText={setLine1}
            placeholder="12 Fairway Close"
            autoCapitalize="words"
            autoComplete="address-line1"
            error={detailsErrors.line1}
            disabled={submitting}
          />
          <PayoutField
            label="Address line 2"
            value={line2}
            onChangeText={setLine2}
            optional
            autoCapitalize="words"
            autoComplete="address-line2"
            disabled={submitting}
          />
          <Row gap="$md" flexWrap="wrap">
            <PayoutField
              label="Town or city"
              value={city}
              onChangeText={setCity}
              placeholder="Leeds"
              autoCapitalize="words"
              error={detailsErrors.city}
              disabled={submitting}
              flex={1}
            />
            <PayoutField
              label="Postcode"
              value={postalCode}
              onChangeText={(value) => setPostalCode(value.toUpperCase())}
              placeholder="LS1 4AP"
              autoCapitalize="characters"
              autoComplete="postal-code"
              error={detailsErrors.postalCode}
              disabled={submitting}
              flex={1}
            />
          </Row>
          <PayoutField
            label="Mobile number"
            value={phone}
            onChangeText={setPhone}
            placeholder="07700 900123"
            keyboardType="phone-pad"
            inputMode="tel"
            autoComplete="tel"
            error={detailsErrors.phone}
            disabled={submitting}
          />
        </Column>

        <Column gap="$sm">
          <Button
            butterVariant="primary"
            size="$5"
            width="100%"
            onPress={() => void handleDetailsSubmit()}
            disabled={busy}
            icon={submitting ? <Spinner size="sm" color="$textInverse" /> : undefined}
          >
            {submitting ? "Saving..." : "Continue"}
          </Button>
          <Text size="$3" color="$textSecondary" textAlign="center">
            By continuing you agree to our{" "}
            <Text
              tag="span"
              size="$3"
              color="$primary"
              textDecorationLine="underline"
              cursor="pointer"
              onPress={() => onOpenLink?.(termsHref)}
            >
              Terms of Service
            </Text>
            , which include the{" "}
            <Text
              tag="span"
              size="$3"
              color="$primary"
              textDecorationLine="underline"
              cursor="pointer"
              onPress={() => onOpenLink?.(STRIPE_AGREEMENT_URL)}
            >
              Stripe Connected Account Agreement
            </Text>
            .
          </Text>
        </Column>
      </Column>
    );
  }

  function renderBank() {
    return (
      <Column gap="$lg" width="100%">
        <Column gap="$xs">
          <Heading level={3}>Where should we send your money?</Heading>
          <Text size="$5" color="$textSecondary">
            Payouts go straight to this account once a sale is complete.
          </Text>
        </Column>

        {errorCard}

        <Column gap="$md">
          <PayoutField
            label="Name on the account"
            value={accountHolderName}
            onChangeText={setAccountHolderName}
            placeholder="Jamie Sutherland"
            autoCapitalize="words"
            error={bankErrors.accountHolderName}
            disabled={submitting}
          />
          <Row gap="$md" flexWrap="wrap">
            <PayoutField
              label="Sort code"
              value={sortCode}
              onChangeText={(value) => setSortCode(formatSortCodeInput(value))}
              placeholder="12-34-56"
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={8}
              error={bankErrors.sortCode}
              disabled={submitting}
              flex={1}
            />
            <PayoutField
              label="Account number"
              value={accountNumber}
              onChangeText={(value) => setAccountNumber(digitsOnly(value, 8))}
              placeholder="12345678"
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={8}
              error={bankErrors.accountNumber}
              disabled={submitting}
              flex={1}
            />
          </Row>
        </Column>

        <Row gap="$sm" alignItems="flex-start">
          <Lock size={16} color="$textSecondary" />
          <Text size="$3" color="$textSecondary" flex={1}>
            Your bank details go directly to Stripe, our payments provider. We never see or store
            them.
          </Text>
        </Row>

        <Button
          butterVariant="primary"
          size="$5"
          width="100%"
          onPress={() => void handleBankSubmit()}
          disabled={busy}
          icon={submitting ? <Spinner size="sm" color="$textInverse" /> : undefined}
        >
          {submitting ? "Saving..." : "Save bank account"}
        </Button>
      </Column>
    );
  }

  function renderVerificationStep(current: PayoutStatus) {
    return (
      <Column gap="$lg" width="100%">
        <Column gap="$xs">
          <Row gap="$sm" alignItems="center">
            <ShieldCheck size={22} color="$primary" />
            <Heading level={3}>One last check</Heading>
          </Row>
          <Text size="$5" color="$textSecondary">
            To keep the marketplace safe we occasionally need to verify who you are.
          </Text>
        </Column>

        {errorCard}

        {renderVerification ? (
          renderVerification({ status: current, onDone: () => void loadStatus() })
        ) : (
          <Column gap="$md">
            <Text size="$4" color="$textSecondary">
              We&apos;ll ask you to confirm your identity — usually a photo of your ID — before your
              first payout. Check back shortly.
            </Text>
            {checkAgainButton}
          </Column>
        )}
      </Column>
    );
  }

  function renderReview(current: PayoutStatus) {
    const { requirements } = current;

    let heading = "We're checking your details";
    let body = "This usually takes a few minutes. You can keep selling in the meantime.";
    if (current.status === "rejected") {
      heading = "We can't pay out to this account";
      body =
        "Stripe, our payments provider, can't verify this account. Get in touch at support@buttergolf.co.uk and we'll help you sort it out.";
    } else if (current.status === "restricted") {
      heading = "Something needs fixing";
      body = "Payouts are paused until these are sorted.";
    }

    const reasons =
      requirements.errors.length > 0
        ? requirements.errors.map((item) => item.reason)
        : [...requirements.pastDue, ...requirements.currentlyDue].map(humaniseRequirement);

    return (
      <Column gap="$lg" width="100%">
        <Column gap="$xs">
          <Heading level={3}>{heading}</Heading>
          <Text size="$5" color="$textSecondary">
            {body}
          </Text>
        </Column>

        {errorCard}

        {current.status === "restricted" && reasons.length > 0 ? (
          <Card variant="outlined" padding="$md">
            <Column gap="$sm">
              {reasons.map((reason) => (
                <Text key={reason} size="$4" color="$text">
                  {reason}
                </Text>
              ))}
            </Column>
          </Card>
        ) : null}

        <Column gap="$sm">
          {current.status === "restricted" ? (
            <Row gap="$sm" flexWrap="wrap">
              <Button
                butterVariant="primary"
                size="$4"
                onPress={() => setStep("details")}
                disabled={busy}
                flex={1}
              >
                Update details
              </Button>
              <Button
                butterVariant="secondary"
                size="$4"
                onPress={() => setStep("bank")}
                disabled={busy}
                flex={1}
              >
                Update bank account
              </Button>
            </Row>
          ) : null}
          {checkAgainButton}
        </Column>
      </Column>
    );
  }

  function renderComplete(current: PayoutStatus) {
    const { bankAccount } = current;
    return (
      <Column gap="$lg" width="100%" alignItems="stretch">
        <Column gap="$sm" alignItems="center">
          <CheckCircle size={44} color="$success" />
          <Heading level={3} textAlign="center">
            You&apos;re set up to get paid
          </Heading>
          <Text size="$5" color="$textSecondary" textAlign="center">
            When a sale completes we&apos;ll send the money straight to your bank.
          </Text>
        </Column>

        {errorCard}

        {bankAccount ? (
          <Card variant="outlined" padding="$md">
            <Row gap="$md" alignItems="center">
              <Banknote size={24} color="$textSecondary" />
              <Column gap="$xs" flex={1} minWidth={0}>
                <Text size="$5" fontWeight="600" color="$text">
                  {bankAccount.bankName ?? "Bank account"}
                </Text>
                <Text size="$4" color="$textSecondary">
                  {`•••• ${bankAccount.last4}`}
                </Text>
                {bankAccount.sortCode ? (
                  <Text size="$3" color="$textSecondary">
                    {`Sort code ${bankAccount.sortCode}`}
                  </Text>
                ) : null}
                {bankAccount.accountHolderName ? (
                  <Text size="$3" color="$textSecondary">
                    {bankAccount.accountHolderName}
                  </Text>
                ) : null}
              </Column>
            </Row>
          </Card>
        ) : null}

        <Column gap="$sm">
          <Button
            butterVariant="primary"
            size="$5"
            width="100%"
            onPress={() => onComplete?.(current)}
          >
            Done
          </Button>
          <Button
            butterVariant="secondary"
            size="$4"
            width="100%"
            onPress={() => {
              setBankErrors({});
              setFormError(null);
              setStep("bank");
            }}
          >
            Change bank account
          </Button>
        </Column>
      </Column>
    );
  }

  function renderStep() {
    if (step === "loading" || !status) return renderLoading();
    if (step === "details") return renderDetails();
    if (step === "bank") return renderBank();
    if (step === "verification") return renderVerificationStep(status);
    if (step === "complete") return renderComplete(status);
    return renderReview(status);
  }

  return (
    <Column gap="$lg" width="100%" maxWidth={560} alignSelf="center">
      {showHeader ? (
        <Row alignItems="center" gap="$sm">
          <Button
            butterVariant="ghost"
            circular
            size="$4"
            onPress={() => onExit?.()}
            aria-label="Go back"
          >
            <ChevronLeft size={22} color="$text" />
          </Button>
          <Heading level={5} flex={1}>
            Get paid
          </Heading>
        </Row>
      ) : null}

      {renderStep()}
    </Column>
  );
}
