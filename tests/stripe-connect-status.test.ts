import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { deriveConnectStatus, getRequestClientIp } from "../apps/web/src/lib/stripe-connect-status";

/**
 * `deriveConnectStatus` is the one place that decides whether a seller can be
 * paid — the status routes, the Connect webhook and `stripeOnboardingComplete`
 * all read it. These cases pin the account shapes Stripe actually returns for
 * a GB individual account with the transfers capability.
 *
 * The module under test deliberately imports nothing that touches env, so this
 * runs without a STRIPE_SECRET_KEY.
 */

type PartialAccount = Partial<Stripe.Account> & Record<string, unknown>;

function account(fields: PartialAccount): Stripe.Account {
  return fields as unknown as Stripe.Account;
}

function requirements(fields: Partial<Stripe.Account.Requirements>): Stripe.Account.Requirements {
  return {
    alternatives: [],
    current_deadline: null,
    currently_due: [],
    disabled_reason: null,
    errors: [],
    eventually_due: [],
    past_due: [],
    pending_verification: [],
    ...fields,
  } as Stripe.Account.Requirements;
}

function bankAccount(fields: Partial<Stripe.BankAccount> = {}): Stripe.BankAccount {
  return {
    object: "bank_account",
    id: "ba_123",
    bank_name: "STRIPE TEST BANK",
    last4: "2345",
    routing_number: "10-88-00",
    account_holder_name: "Jane Doe",
    ...fields,
  } as Stripe.BankAccount;
}

/** Everything Stripe asks a fresh GB individual account for. */
const FRESH_GB_REQUIREMENTS = [
  "individual.first_name",
  "individual.last_name",
  "individual.dob.day",
  "individual.dob.month",
  "individual.dob.year",
  "individual.address.line1",
  "individual.address.city",
  "individual.address.postal_code",
  "individual.phone",
  "business_profile.url",
  "tos_acceptance.date",
  "tos_acceptance.ip",
  "external_account",
];

describe("deriveConnectStatus", () => {
  it("treats a freshly created account as pending, needing details and a bank account", () => {
    const summary = deriveConnectStatus(
      account({
        id: "acct_fresh",
        payouts_enabled: false,
        capabilities: { transfers: "inactive" } as Stripe.Account.Capabilities,
        requirements: requirements({ currently_due: FRESH_GB_REQUIREMENTS }),
      })
    );

    expect(summary.status).toBe("pending");
    expect(summary.isComplete).toBe(false);
    expect(summary.needsDetails).toBe(true);
    expect(summary.needsBankAccount).toBe(true);
    expect(summary.needsVerification).toBe(false);
    expect(summary.verificationFields).toEqual([]);
    expect(summary.bankAccount).toBeNull();
    expect(summary.hasDob).toBe(false);
    expect(summary.requirements.currentlyDue).toEqual(FRESH_GB_REQUIREMENTS);
  });

  it("is active and complete once payouts and transfers are on with nothing due", () => {
    const summary = deriveConnectStatus(
      account({
        id: "acct_done",
        payouts_enabled: true,
        capabilities: { transfers: "active" } as Stripe.Account.Capabilities,
        requirements: requirements({}),
        individual: { dob: { day: 1, month: 6, year: 1990 } } as Stripe.Person,
        external_accounts: {
          object: "list",
          data: [bankAccount()],
          has_more: false,
          url: "",
        } as Stripe.ApiList<Stripe.BankAccount>,
      })
    );

    expect(summary.status).toBe("active");
    expect(summary.isComplete).toBe(true);
    expect(summary.payoutsEnabled).toBe(true);
    expect(summary.transfersActive).toBe(true);
    expect(summary.needsDetails).toBe(false);
    expect(summary.needsBankAccount).toBe(false);
    expect(summary.needsVerification).toBe(false);
    expect(summary.hasDob).toBe(true);
    expect(summary.bankAccount).toEqual({
      bankName: "STRIPE TEST BANK",
      last4: "2345",
      sortCode: "10-88-00",
      accountHolderName: "Jane Doe",
    });
  });

  it("surfaces an identity document as a verification requirement for Stripe's component", () => {
    const summary = deriveConnectStatus(
      account({
        id: "acct_doc",
        payouts_enabled: false,
        capabilities: { transfers: "pending" } as Stripe.Account.Capabilities,
        requirements: requirements({ currently_due: ["individual.verification.document"] }),
        external_accounts: {
          object: "list",
          data: [bankAccount()],
          has_more: false,
          url: "",
        } as Stripe.ApiList<Stripe.BankAccount>,
      })
    );

    expect(summary.needsVerification).toBe(true);
    expect(summary.verificationFields).toEqual(["individual.verification.document"]);
    expect(summary.needsDetails).toBe(false);
    expect(summary.needsBankAccount).toBe(false);
    expect(summary.isComplete).toBe(false);
  });

  it("never treats an account with past-due requirements as complete, even with payouts enabled", () => {
    const summary = deriveConnectStatus(
      account({
        id: "acct_pastdue",
        payouts_enabled: true,
        capabilities: { transfers: "active" },
        requirements: requirements({
          currently_due: [],
          past_due: ["individual.verification.document"],
        }),
        external_accounts: { object: "list", data: [bankAccount()], has_more: false, url: "" },
      })
    );
    expect(summary.isComplete).toBe(false);
    expect(summary.status).toBe("restricted");
  });

  it("never treats a rejected account as complete, whatever its capability flags say", () => {
    const summary = deriveConnectStatus(
      account({
        id: "acct_rejected",
        payouts_enabled: true,
        capabilities: { transfers: "active" },
        requirements: requirements({ disabled_reason: "rejected.fraud" }),
        external_accounts: { object: "list", data: [bankAccount()], has_more: false, url: "" },
      })
    );
    expect(summary.isComplete).toBe(false);
    expect(summary.status).toBe("rejected");
  });

  it("treats a fresh account's past_due (no deadline, never enabled) as pending, not restricted", () => {
    // Exactly what Stripe returns seconds after creation: requirements in
    // past_due, disabled_reason requirements.past_due, no deadline.
    const summary = deriveConnectStatus(
      account({
        id: "acct_fresh_past_due",
        payouts_enabled: false,
        capabilities: { transfers: "inactive" } as Stripe.Account.Capabilities,
        requirements: requirements({
          currently_due: ["external_account", "individual.dob.day"],
          past_due: ["external_account", "individual.dob.day"],
          disabled_reason: "requirements.past_due",
          current_deadline: null,
        }),
      })
    );
    expect(summary.status).toBe("pending");
    expect(summary.needsDetails).toBe(true);
    expect(summary.needsBankAccount).toBe(true);
  });

  it("is restricted when a previously complete seller has something past due", () => {
    const summary = deriveConnectStatus(
      account({
        id: "acct_was_active",
        payouts_enabled: false,
        capabilities: { transfers: "inactive" } as Stripe.Account.Capabilities,
        requirements: requirements({
          currently_due: ["individual.verification.document"],
          past_due: ["individual.verification.document"],
          disabled_reason: "requirements.past_due",
        }),
      }),
      { wasComplete: true }
    );
    expect(summary.status).toBe("restricted");
  });

  it("is restricted once a Stripe deadline has passed", () => {
    const summary = deriveConnectStatus(
      account({
        id: "acct_late",
        payouts_enabled: false,
        capabilities: { transfers: "inactive" } as Stripe.Account.Capabilities,
        requirements: requirements({
          currently_due: ["individual.verification.document"],
          past_due: ["individual.verification.document"],
          current_deadline: 1_760_000_000,
        }),
      })
    );

    expect(summary.status).toBe("restricted");
    expect(summary.requirements.currentDeadline).toBe(new Date(1_760_000_000 * 1000).toISOString());
  });

  it("is rejected when Stripe has rejected the account, deadline or not", () => {
    const summary = deriveConnectStatus(
      account({
        id: "acct_rejected",
        payouts_enabled: false,
        capabilities: { transfers: "inactive" } as Stripe.Account.Capabilities,
        requirements: requirements({
          disabled_reason: "rejected.fraud",
          past_due: ["individual.verification.document"],
        }),
      })
    );

    expect(summary.status).toBe("rejected");
    expect(summary.requirements.disabledReason).toBe("rejected.fraud");
  });
});

describe("getRequestClientIp", () => {
  it("takes the first hop of x-forwarded-for", () => {
    const request = new Request("https://buttergolf.com/api/stripe/connect/setup/details", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" },
    });
    expect(getRequestClientIp(request)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    const request = new Request("https://buttergolf.com/api/stripe/connect/setup/details", {
      headers: { "x-real-ip": "203.0.113.7" },
    });
    expect(getRequestClientIp(request)).toBe("203.0.113.7");
  });

  it("returns null when neither header is present", () => {
    expect(getRequestClientIp(new Request("https://buttergolf.com/"))).toBeNull();
  });
});
