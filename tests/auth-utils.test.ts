import { describe, it, expect } from "vitest";
import {
  validateEmail,
  getPasswordStrength,
  validatePassword,
  validatePasswordMatch,
  validateFirstName,
  validateLastName,
  validateVerificationCode,
  mapClerkErrorToMessage,
  validateSignInForm,
  validateSignUpForm,
} from "../packages/app/src/features/auth/utils";

describe("validateEmail", () => {
  it("accepts a well-formed email", () => {
    expect(validateEmail("player@buttergolf.com")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(validateEmail("")).toBe("Email is required");
    expect(validateEmail("   ")).toBe("Email is required");
  });

  it("rejects malformed addresses", () => {
    expect(validateEmail("not-an-email")).not.toBeNull();
    expect(validateEmail("a@b")).not.toBeNull();
    expect(validateEmail("a@b.")).not.toBeNull();
    expect(validateEmail("@buttergolf.com")).not.toBeNull();
  });
});

describe("getPasswordStrength", () => {
  it("is weak for short passwords regardless of variety", () => {
    expect(getPasswordStrength("Ab1!")).toBe("weak");
  });

  it("is fair for two character classes and no length bonus", () => {
    expect(getPasswordStrength("abcd1234")).toBe("fair");
  });

  it("is good for three character classes", () => {
    expect(getPasswordStrength("Abcd1234")).toBe("good");
  });

  it("is strong for four character classes", () => {
    expect(getPasswordStrength("Abcd123!")).toBe("strong");
  });

  it("counts a length bonus at 12+ characters", () => {
    // 3 character classes + length bonus (12 chars) → strength 4 → strong
    expect(getPasswordStrength("Abcdefgh1234")).toBe("strong");
  });
});

describe("validatePassword", () => {
  it("requires a password", () => {
    const result = validatePassword("");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Password is required");
    expect(result.strength).toBe("weak");
  });

  it("enforces an 8 character minimum", () => {
    const result = validatePassword("Ab1!");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Password must be at least 8 characters");
  });

  it("rejects fair-strength passwords on sign-up", () => {
    const result = validatePassword("abcd1234");
    expect(result.isValid).toBe(false);
    expect(result.strength).toBe("fair");
  });

  it("accepts good-strength passwords", () => {
    const result = validatePassword("Abcd1234");
    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.strength).toBe("good");
  });

  it("accepts strong passwords", () => {
    const result = validatePassword("Abcd123!@#");
    expect(result.isValid).toBe(true);
    expect(result.strength).toBe("strong");
  });
});

describe("validatePasswordMatch", () => {
  it("passes when passwords match", () => {
    expect(validatePasswordMatch("secret123", "secret123")).toBeNull();
  });

  it("fails when the confirmation is empty", () => {
    expect(validatePasswordMatch("secret123", "")).toBe("Please confirm your password");
  });

  it("fails on mismatch", () => {
    expect(validatePasswordMatch("secret123", "secret124")).toBe("Passwords do not match");
  });
});

describe("validateFirstName / validateLastName", () => {
  it("requires a first name of at least 2 characters", () => {
    expect(validateFirstName("")).toBe("First name is required");
    expect(validateFirstName("A")).toBe("First name must be at least 2 characters");
    expect(validateFirstName("Jo")).toBeNull();
  });

  it("requires a last name of at least 2 characters", () => {
    expect(validateLastName("")).toBe("Last name is required");
    expect(validateLastName("B")).toBe("Last name must be at least 2 characters");
    expect(validateLastName("Moreton")).toBeNull();
  });
});

describe("validateVerificationCode", () => {
  it("accepts a 6-digit code", () => {
    expect(validateVerificationCode("123456")).toBeNull();
    expect(validateVerificationCode("  123456  ")).toBeNull();
  });

  it("rejects empty or non-6-digit codes", () => {
    expect(validateVerificationCode("")).toBe("Verification code is required");
    expect(validateVerificationCode("12345")).toBe("Verification code must be 6 digits");
    expect(validateVerificationCode("1234567")).toBe("Verification code must be 6 digits");
    expect(validateVerificationCode("abcdef")).toBe("Verification code must be 6 digits");
  });
});

describe("mapClerkErrorToMessage", () => {
  it("maps known Clerk error codes to friendly messages", () => {
    expect(mapClerkErrorToMessage("identifier_not_found")).toBe("Email address not found");
    expect(mapClerkErrorToMessage("password_incorrect")).toBe("Incorrect password");
    expect(mapClerkErrorToMessage("duplicate_identifier")).toBe("This email is already registered");
    expect(mapClerkErrorToMessage("verification_code_expired")).toBe(
      "Verification code has expired. Please request a new one."
    );
  });

  it("falls back to a generic message for unknown codes", () => {
    expect(mapClerkErrorToMessage("some_unknown_code")).toBe(
      "An error occurred. Please try again or contact support."
    );
  });
});

describe("validateSignInForm", () => {
  it("is valid with an email and password", () => {
    const result = validateSignInForm("player@buttergolf.com", "password");
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("reports errors for missing fields", () => {
    const result = validateSignInForm("", "");
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBe("Email is required");
    expect(result.errors.password).toBe("Password is required");
  });

  it("reports an error for a malformed email", () => {
    const result = validateSignInForm("not-an-email", "password");
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBe("Please enter a valid email address");
  });
});

describe("validateSignUpForm", () => {
  const validEmail = "player@buttergolf.com";
  const validPassword = "Abcd123!@#";

  it("is valid with all fields correct", () => {
    const result = validateSignUpForm("Josh", "Moreton", validEmail, validPassword, validPassword);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("collects multiple errors at once", () => {
    const result = validateSignUpForm("", "", "", "", "");
    expect(result.isValid).toBe(false);
    expect(result.errors.firstName).toBeDefined();
    expect(result.errors.lastName).toBeDefined();
    expect(result.errors.email).toBeDefined();
    expect(result.errors.password).toBeDefined();
    expect(result.errors.confirmPassword).toBeDefined();
  });

  it("flags a password mismatch", () => {
    const result = validateSignUpForm("Josh", "Moreton", validEmail, validPassword, "different");
    expect(result.isValid).toBe(false);
    expect(result.errors.confirmPassword).toBe("Passwords do not match");
  });
});
