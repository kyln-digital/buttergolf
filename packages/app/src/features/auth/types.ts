/**
 * Authentication types and interfaces
 */

/**
 * Form submission state enum
 */
export enum FormState {
  Idle = "idle",
  Loading = "loading",
  Error = "error",
  Success = "success",
}

/**
 * Password strength levels
 */
export type PasswordStrength = "weak" | "fair" | "good" | "strong";

/**
 * Sign-in form state
 */
export interface SignInFormData {
  email: string;
  password: string;
}

/**
 * Sign-up form state
 */
export interface SignUpFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * Verify email form state
 */
export interface VerifyEmailFormData {
  code: string;
}

/**
 * Forgot password form state
 */
export interface ForgotPasswordFormData {
  email: string;
}

/**
 * Reset password form state
 */
export interface ResetPasswordFormData {
  code: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Two-factor authentication form state
 */
export interface TwoFactorFormData {
  code: string;
}

/**
 * Field-level validation error
 */
export interface FieldError {
  field: string;
  message: string;
}

/**
 * Form validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Clerk API error response
 */
export interface ClerkError {
  code: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * OAuth button configuration
 */
export interface OAuthProvider {
  name: "google" | "apple";
  label: string;
  isAvailable: boolean;
}
