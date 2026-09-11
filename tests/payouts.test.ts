import { describe, it, expect } from "vitest";
import {
  classifyPayoutRequirement,
  classifyPayoutRequirements,
  formatSortCode,
  normaliseAccountNumber,
  normaliseSortCode,
  normaliseUkPhone,
  normaliseUkPostcode,
  validateBankAccountInput,
  validateDob,
  validatePayoutDetails,
  type PayoutDetailsInput,
} from "@buttergolf/constants";

/**
 * The pure half of seller payout setup: everything the details and bank
 * screens validate before anything reaches Stripe.
 */

// A fixed "today" so age checks don't drift as the suite ages.
const TODAY = new Date(Date.UTC(2026, 8, 11)); // 11 September 2026

describe("normaliseUkPhone", () => {
  it("accepts a UK number written with a leading zero", () => {
    expect(normaliseUkPhone("07700 900123")).toBe("+447700900123");
    expect(normaliseUkPhone("07700900123")).toBe("+447700900123");
  });

  it("accepts an already-international UK number", () => {
    expect(normaliseUkPhone("+44 7700 900123")).toBe("+447700900123");
  });

  it("accepts the 0044 international prefix", () => {
    expect(normaliseUkPhone("0044 7700 900123")).toBe("+447700900123");
  });

  it("drops the trunk zero from the +44(0) form", () => {
    expect(normaliseUkPhone("+44 (0)7700 900123")).toBe("+447700900123");
  });

  it("passes a valid non-UK E.164 number through unchanged", () => {
    expect(normaliseUkPhone("+14155551234")).toBe("+14155551234");
  });

  it("rejects anything that isn't a phone number", () => {
    expect(normaliseUkPhone("not a phone")).toBeNull();
    expect(normaliseUkPhone("")).toBeNull();
    expect(normaliseUkPhone("   ")).toBeNull();
    expect(normaliseUkPhone("0770")).toBeNull();
  });
});

describe("normaliseSortCode / formatSortCode", () => {
  it("strips separators down to six digits", () => {
    expect(normaliseSortCode("12-34-56")).toBe("123456");
    expect(normaliseSortCode("12 34 56")).toBe("123456");
    expect(normaliseSortCode("123456")).toBe("123456");
  });

  it("rejects anything that isn't six digits", () => {
    expect(normaliseSortCode("12345")).toBeNull();
    expect(normaliseSortCode("1234567")).toBeNull();
    expect(normaliseSortCode("ab-cd-ef")).toBeNull();
  });

  it("formats a normalised sort code for display", () => {
    expect(formatSortCode("123456")).toBe("12-34-56");
    expect(formatSortCode("12-34-56")).toBe("12-34-56");
  });

  it("returns the input untouched when it isn't six digits", () => {
    expect(formatSortCode("12345")).toBe("12345");
  });
});

describe("normaliseAccountNumber", () => {
  it("keeps an eight-digit number as-is", () => {
    expect(normaliseAccountNumber("12345678")).toBe("12345678");
    expect(normaliseAccountNumber("1234 5678")).toBe("12345678");
  });

  it("left-pads six- and seven-digit numbers, which is what the bank expects", () => {
    expect(normaliseAccountNumber("1234567")).toBe("01234567");
    expect(normaliseAccountNumber("123456")).toBe("00123456");
  });

  it("rejects fewer than six digits, more than eight, and letters", () => {
    expect(normaliseAccountNumber("12345")).toBeNull();
    expect(normaliseAccountNumber("123456789")).toBeNull();
    expect(normaliseAccountNumber("1234567a")).toBeNull();
  });
});

describe("normaliseUkPostcode", () => {
  it("upper-cases and inserts the single space", () => {
    expect(normaliseUkPostcode("sw1a1aa")).toBe("SW1A 1AA");
    expect(normaliseUkPostcode("SW1A 1AA")).toBe("SW1A 1AA");
    expect(normaliseUkPostcode("m11ae")).toBe("M1 1AE");
    expect(normaliseUkPostcode("  b33 8th ")).toBe("B33 8TH");
  });

  it("rejects strings that aren't UK postcodes", () => {
    expect(normaliseUkPostcode("12345")).toBeNull();
    expect(normaliseUkPostcode("SW1A")).toBeNull();
    expect(normaliseUkPostcode("NOTAPOSTCODE")).toBeNull();
  });
});

describe("validateDob", () => {
  it("accepts a real date for an adult", () => {
    expect(validateDob({ day: 1, month: 6, year: 1990 }, TODAY)).toBeNull();
  });

  it("accepts someone who turned 18 today", () => {
    expect(validateDob({ day: 11, month: 9, year: 2008 }, TODAY)).toBeNull();
  });

  it("rejects someone under 18", () => {
    expect(validateDob({ day: 12, month: 9, year: 2008 }, TODAY)).toBe(
      "You must be at least 18 to sell on ButterGolf"
    );
  });

  it("rejects a date that doesn't exist", () => {
    expect(validateDob({ day: 30, month: 2, year: 1990 }, TODAY)).toBe("That date doesn't exist");
  });

  it("rejects years before 1900", () => {
    expect(validateDob({ day: 1, month: 1, year: 1899 }, TODAY)).toBe("Enter a valid year");
  });

  it("rejects someone implausibly old", () => {
    expect(validateDob({ day: 1, month: 1, year: 1901 }, TODAY)).toBe(
      "Enter a valid date of birth"
    );
  });

  it("rejects non-integer parts", () => {
    expect(validateDob({ day: NaN, month: NaN, year: NaN }, TODAY)).toBe(
      "Enter your date of birth as day, month and year"
    );
  });
});

describe("validatePayoutDetails", () => {
  const valid: PayoutDetailsInput = {
    firstName: "  Jane ",
    lastName: " Doe ",
    dob: { day: 1, month: 6, year: 1990 },
    address: {
      line1: " 1 High Street ",
      line2: " Flat 2 ",
      city: " London ",
      postalCode: "sw1a1aa",
    },
    phone: "07700 900123",
  };

  it("trims and normalises a valid submission", () => {
    const result = validatePayoutDetails(valid, TODAY);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      dob: { day: 1, month: 6, year: 1990 },
      address: {
        line1: "1 High Street",
        line2: "Flat 2",
        city: "London",
        postalCode: "SW1A 1AA",
      },
      phone: "+447700900123",
    });
  });

  it("omits line2 entirely when it is blank", () => {
    const result = validatePayoutDetails(
      { ...valid, address: { ...valid.address, line2: "  " } },
      TODAY
    );
    expect(result.ok).toBe(true);
    expect(result.value?.address).not.toHaveProperty("line2");
  });

  it("reports one error per bad field and returns no value", () => {
    const result = validatePayoutDetails(
      {
        firstName: "",
        lastName: "   ",
        dob: { day: 1, month: 1, year: 2020 },
        address: { line1: "", city: "", postalCode: "nope" },
        phone: "banana",
      },
      TODAY
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBeUndefined();
    expect(result.errors).toEqual({
      firstName: "Enter your first name",
      lastName: "Enter your last name",
      dob: "You must be at least 18 to sell on ButterGolf",
      line1: "Enter the first line of your address",
      city: "Enter your town or city",
      postalCode: "Enter a valid UK postcode",
      phone: "Enter a valid mobile number",
    });
  });
});

describe("validateBankAccountInput", () => {
  it("normalises the sort code and account number", () => {
    const result = validateBankAccountInput({
      accountHolderName: "  Jane Doe ",
      sortCode: "10-88-00",
      accountNumber: "1234567",
    });
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      accountHolderName: "Jane Doe",
      sortCode: "108800",
      accountNumber: "01234567",
    });
  });

  it("reports each invalid field", () => {
    const result = validateBankAccountInput({
      accountHolderName: "J",
      sortCode: "1088",
      accountNumber: "123456789",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual({
      accountHolderName: "Enter the name on the account",
      sortCode: "Sort code must be 6 digits",
      accountNumber: "Account number must be 8 digits",
    });
  });
});

describe("classifyPayoutRequirement", () => {
  it("routes the bank account to our bank step", () => {
    expect(classifyPayoutRequirement("external_account")).toBe("bank");
  });

  it("routes identity documents to Stripe's component", () => {
    expect(classifyPayoutRequirement("individual.verification.document")).toBe("verification");
    expect(classifyPayoutRequirement("individual.verification.additional_document")).toBe(
      "verification"
    );
    expect(classifyPayoutRequirement("documents.proof_of_registration.files")).toBe("verification");
  });

  it("routes everything our own form collects to the details step", () => {
    expect(classifyPayoutRequirement("individual.dob.day")).toBe("details");
    expect(classifyPayoutRequirement("individual.first_name")).toBe("details");
    expect(classifyPayoutRequirement("individual.address.line1")).toBe("details");
    expect(classifyPayoutRequirement("tos_acceptance.ip")).toBe("details");
    expect(classifyPayoutRequirement("business_profile.url")).toBe("details");
  });

  it("routes only the business_profile fields the details endpoint sets", () => {
    expect(classifyPayoutRequirement("business_profile.mcc")).toBe("details");
    expect(classifyPayoutRequirement("business_profile.product_description")).toBe("details");
    // Anything else in the namespace must reach Stripe's component, not loop on our form.
    expect(classifyPayoutRequirement("business_profile.support_phone")).toBe("verification");
    expect(classifyPayoutRequirement("business_profile.support_email")).toBe("verification");
  });

  it("sends anything it doesn't recognise to Stripe rather than guessing", () => {
    expect(classifyPayoutRequirement("company.tax_id")).toBe("verification");
    expect(classifyPayoutRequirement("settings.payments.statement_descriptor")).toBe(
      "verification"
    );
    expect(classifyPayoutRequirement("something.brand.new")).toBe("verification");
  });
});

describe("classifyPayoutRequirements", () => {
  it("summarises a mixed requirement list", () => {
    const result = classifyPayoutRequirements([
      "individual.first_name",
      "individual.dob.day",
      "external_account",
      "individual.verification.document",
      "individual.first_name", // duplicate
    ]);
    expect(result).toEqual({
      needsDetails: true,
      needsBankAccount: true,
      needsVerification: true,
      verificationFields: ["individual.verification.document"],
    });
  });

  it("reports nothing outstanding for an empty list", () => {
    expect(classifyPayoutRequirements([])).toEqual({
      needsDetails: false,
      needsBankAccount: false,
      needsVerification: false,
      verificationFields: [],
    });
  });
});
