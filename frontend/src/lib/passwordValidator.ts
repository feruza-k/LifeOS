/**
 * Password validation utilities for LifeOS frontend.
 * Enforces strong password rules matching backend validation.
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }

  if (!/[a-zA-Z]/.test(password)) {
    errors.push("Password must contain at least one letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push("Password must contain at least one symbol");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function getPasswordRequirements(): string[] {
  return [
    "Minimum 8 characters",
    "At least 1 letter",
    "At least 1 number",
    "At least 1 symbol",
  ];
}

