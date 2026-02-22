// functions/lib/crypto.js - Secure password hashing with bcrypt
import bcrypt from 'bcryptjs';

/**
 * Hash a password using bcrypt with cost factor 12
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Bcrypt hash
 */
export async function hashPassword(password) {
  const saltRounds = 12; // Cost factor (higher = more secure but slower)
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a bcrypt hash
 * @param {string} password - Plain text password to verify
 * @param {string} storedHash - Stored bcrypt hash
 * @returns {Promise<boolean>} - True if password matches
 */
export async function verifyPassword(password, storedHash) {
  return await bcrypt.compare(password, storedHash);
}

/**
 * Hash a security answer (case-insensitive)
 * @param {string} answer - Security question answer
 * @returns {Promise<string>} - Bcrypt hash
 */
export async function hashSecurityAnswer(answer) {
  // Normalize: trim whitespace and convert to lowercase for case-insensitive comparison
  const normalized = answer.trim().toLowerCase();
  return await hashPassword(normalized);
}

/**
 * Verify a security answer (case-insensitive)
 * @param {string} answer - Security answer to verify
 * @param {string} storedHash - Stored hash
 * @returns {Promise<boolean>} - True if answer matches
 */
export async function verifySecurityAnswer(answer, storedHash) {
  const normalized = answer.trim().toLowerCase();
  return await verifyPassword(normalized, storedHash);
}

/**
 * Generate a cryptographically secure random token
 * @param {number} length - Length of the token (default: 32)
 * @returns {string} - Random hex string
 */
export function generateToken(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - {valid: boolean, errors: string[]}
 */
export function validatePasswordStrength(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
