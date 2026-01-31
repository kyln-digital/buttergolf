/**
 * Authentication utilities and validation functions
 */

import { PasswordStrength, ValidationResult } from "./types";

/**
 * Validates email format
 */
export function validateEmail(email: string): string | null {
  if (!email.trim()) {
    return "Email is required";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Please enter a valid email address";
  }

  return null;
}

/**
 * Validates password strength
 */
export function validatePassword(password: string): {
  isValid: boolean;
  error: string | null;
  strength: PasswordStrength;
} {
  if (!password) {
    return {
      isValid: false,
      error: "Password is required",
      strength: "weak",
    };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      error: "Password must be at least 8 characters",
      strength: "weak",
    };
  }

  const strength = getPasswordStrength(password);

  // For sign-up, require at least "good" strength
  if (strength === "weak" || strength === "fair") {
    return {
      isValid: false,
      error: "Password must contain uppercase, lowercase, number, and special character",
      strength,
    };
  }

  return {
    isValid: true,
    error: null,
    strength,
  };
}

/**
 * Calculates password strength
 */
export function getPasswordStrength(password: string): PasswordStrength {
  let strength = 0;

  // Check for lowercase letters
  if (/[a-z]/.test(password)) strength++;

  // Check for uppercase letters
  if (/[A-Z]/.test(password)) strength++;

  // Check for numbers
  if (/\d/.test(password)) strength++;

  // Check for special characters
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;

  // Length bonus
  if (password.length >= 12) strength++;

  if (strength === 0 || strength === 1 || password.length < 8) return "weak";
  if (strength === 2) return "fair";
  if (strength === 3) return "good";
  return "strong";
}

/**
 * Validates password confirmation matches
 */
export function validatePasswordMatch(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) {
    return "Please confirm your password";
  }

  if (password !== confirmPassword) {
    return "Passwords do not match";
  }

  return null;
}

/**
 * Validates first name
 */
export function validateFirstName(firstName: string): string | null {
  if (!firstName.trim()) {
    return "First name is required";
  }

  if (firstName.trim().length < 2) {
    return "First name must be at least 2 characters";
  }

  return null;
}

/**
 * Validates last name
 */
export function validateLastName(lastName: string): string | null {
  if (!lastName.trim()) {
    return "Last name is required";
  }

  if (lastName.trim().length < 2) {
    return "Last name must be at least 2 characters";
  }

  return null;
}

/**
 * Validates verification code format
 */
export function validateVerificationCode(code: string): string | null {
  if (!code.trim()) {
    return "Verification code is required";
  }

  // Typically 6 digits
  if (!/^\d{6}$/.test(code.trim())) {
    return "Verification code must be 6 digits";
  }

  return null;
}

/**
 * Maps Clerk error codes to user-friendly messages
 */
export function mapClerkErrorToMessage(errorCode: string): string {
  const errorMap: Record<string, string> = {
    // Sign-in errors
    identifier_not_found: "Email address not found",
    password_incorrect: "Incorrect password",
    auth_method_not_enabled: "Email authentication is not enabled",

    // Sign-up errors
    duplicate_identifier: "This email is already registered",
    password_not_strong_enough:
      "Password is not strong enough. Use uppercase, lowercase, numbers and special characters.",
    form_invalid: "Please check your information and try again",

    // Verification errors
    verification_code_invalid: "Invalid verification code",
    verification_code_expired: "Verification code has expired. Please request a new one.",

    // Network/General errors
    form_error: "An error occurred. Please try again.",
  };

  return errorMap[errorCode] || "An error occurred. Please try again or contact support.";
}

/**
 * Validates sign-in form
 */
export function validateSignInForm(email: string, password: string): ValidationResult {
  const errors: Record<string, string> = {};

  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;

  if (!password) errors.password = "Password is required";

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates sign-up form
 */
export function validateSignUpForm(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  confirmPassword: string
): ValidationResult {
  const errors: Record<string, string> = {};

  const firstNameError = validateFirstName(firstName);
  if (firstNameError) errors.firstName = firstNameError;

  const lastNameError = validateLastName(lastName);
  if (lastNameError) errors.lastName = lastNameError;

  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid && passwordValidation.error) {
    errors.password = passwordValidation.error;
  }

  const passwordMatchError = validatePasswordMatch(password, confirmPassword);
  if (passwordMatchError) errors.confirmPassword = passwordMatchError;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
