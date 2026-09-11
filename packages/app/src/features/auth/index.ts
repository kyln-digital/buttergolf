// Screens
export { SignInScreen } from "./sign-in-screen";
export { SignUpScreen } from "./sign-up-screen";
export { VerifyEmailScreen } from "./verify-email-screen";
export { ForgotPasswordScreen } from "./forgot-password-screen";
export { ResetPasswordScreen } from "./reset-password-screen";
export { TwoFactorScreen } from "./two-factor-screen";

// Components
export { AuthFormInput, AuthErrorDisplay, SocialAuthButtons } from "./components";

// Types
export type {
  FormState,
  PasswordStrength,
  SignInFormData,
  SignUpFormData,
  VerifyEmailFormData,
  ForgotPasswordFormData,
  ResetPasswordFormData,
  TwoFactorFormData,
  FieldError,
  ValidationResult,
  ClerkError,
  OAuthProvider,
} from "./types";

// Utilities
export {
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  validateFirstName,
  validateVerificationCode,
  validateSignInForm,
  validateSignUpForm,
  mapClerkErrorToMessage,
  getPasswordStrength,
} from "./utils";
