/**
 * Shared password validation (works on both server + client).
 */

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push('Must be at least 12 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Must contain an uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Must contain a lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Must contain a digit');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Must contain a special character');
  }

  return { valid: errors.length === 0, errors };
}
