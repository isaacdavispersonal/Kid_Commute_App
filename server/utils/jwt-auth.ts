// JWT Authentication utilities for mobile app
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";

// Require JWT_SECRET in production, fall back in development only
const isProduction = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;

if (isProduction && !JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required in production");
}

const effectiveSecret = JWT_SECRET || "dev-jwt-secret-change-in-production";
if (!JWT_SECRET) {
  console.warn("[JWT] WARNING: Using development secret - set JWT_SECRET for production");
}

const JWT_EXPIRES_DEFAULT = "1d"; // Token valid for 1 day (session-based login)
const JWT_EXPIRES_REMEMBER = "30d"; // Token valid for 30 days (remember me)
const JWT_EXPIRES_DRIVER = "7d"; // Drivers get 7 days by default to avoid clock-out issues (matches config.auth.driverSessionDurationMs)

export interface JwtPayload {
  userId: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 * @param userId - User's unique identifier
 * @param role - User's role
 * @param rememberMe - If true, token has extended expiry (30 days vs 1 day)
 */
export function generateToken(userId: string, role: string, rememberMe: boolean = false): string {
  const payload: JwtPayload = {
    userId,
    role,
  };
  // Drivers get extended session (7 days) to prevent clock-out authorization issues
  // Remember me extends to 30 days for all users
  let expiresIn = JWT_EXPIRES_DEFAULT;
  if (rememberMe) {
    expiresIn = JWT_EXPIRES_REMEMBER;
  } else if (role === "driver") {
    expiresIn = JWT_EXPIRES_DRIVER;
  }
  return jwt.sign(payload, effectiveSecret, { expiresIn: expiresIn as string });
}

/**
 * Verify and decode a JWT token
 * Returns the payload if valid, null if invalid/expired
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, effectiveSecret) as JwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Validate phone number format (10 digits after normalization)
 */
export function validatePhone(phone: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = normalizePhone(phone);
  if (normalized.length === 0) {
    return { valid: false, normalized, error: "Phone number is required" };
  }
  if (normalized.length !== 10) {
    return { valid: false, normalized, error: "Phone number must be 10 digits" };
  }
  return { valid: true, normalized };
}

// Extended request type for mobile auth
export interface MobileAuthRequest extends Request {
  mobileUser?: {
    userId: string;
    role: string;
    user: any;
  };
}

/**
 * Normalize phone number to digits only
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Check if identifier looks like an email
 */
export function isEmail(identifier: string): boolean {
  return identifier.includes("@");
}
