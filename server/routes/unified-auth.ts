// Unified authentication routes (JWT-based for both web and mobile)
import { Router, Request, Response, NextFunction, RequestHandler } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import { mobileLoginSchema, mobileRegisterSchema } from "@shared/schema";
import { 
  hashPassword, 
  verifyPassword, 
  generateToken, 
  verifyToken, 
  normalizePhone, 
  isEmail,
  validatePhone
} from "../utils/jwt-auth";
import { z } from "zod";

const router = Router();

// Cookie settings for web browsers
const COOKIE_NAME = "auth_token";

// Helper to get cookie options based on request
function getCookieOptions(req: Request) {
  // Always use secure cookies on HTTPS (Replit always serves over HTTPS)
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  };
}

/**
 * Helper to extract JWT token from request
 * Checks: 1) Authorization header, 2) Cookie
 */
function extractToken(req: Request): string | null {
  // Check Authorization header first (for mobile apps)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  
  // Check cookie (for web browsers)
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) {
    return cookieToken;
  }
  
  return null;
}

/**
 * Helper to format user response (consistent across all endpoints)
 */
function formatUserResponse(user: any) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    phoneNumber: user.phoneNumber,
    profileImageUrl: user.profileImageUrl,
    address: user.address,
    isLeadDriver: user.isLeadDriver,
  };
}

/**
 * POST /api/auth/login
 * Authenticate with email/phone + password, return JWT token
 */
router.post("/login", async (req, res) => {
  try {
    const parsed = mobileLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        message: "Invalid login data", 
        errors: parsed.error.flatten().fieldErrors 
      });
    }

    const { identifier, password } = parsed.data;
    
    // Look up credentials by email or phone
    let credentials;
    if (isEmail(identifier)) {
      credentials = await storage.getAuthCredentialsByEmail(identifier.toLowerCase().trim());
    } else {
      credentials = await storage.getAuthCredentialsByPhone(normalizePhone(identifier));
    }

    if (!credentials) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!credentials.isActive) {
      return res.status(401).json({ message: "Account is disabled" });
    }

    // Verify password
    const isValid = await verifyPassword(password, credentials.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Get user details
    const user = await storage.getUser(credentials.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Update last login time
    await storage.updateAuthCredentialsLastLogin(credentials.userId);

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    // Set cookie for web browsers
    res.cookie(COOKIE_NAME, token, getCookieOptions(req));

    res.json({
      token,
      user: formatUserResponse(user),
      emailVerified: credentials.emailVerified || false,
      emailVerificationRequired: !!user.email && !credentials.emailVerified,
    });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

/**
 * POST /api/auth/register
 * Create a new account with email/phone + password
 */
router.post("/register", async (req, res) => {
  try {
    const parsed = mobileRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        message: "Invalid registration data", 
        errors: parsed.error.flatten().fieldErrors 
      });
    }

    const { email, phone, password, firstName, lastName } = parsed.data;

    // Validate and normalize phone if provided
    let normalizedPhone: string | undefined;
    if (phone) {
      const phoneValidation = validatePhone(phone);
      if (!phoneValidation.valid) {
        return res.status(400).json({ message: phoneValidation.error });
      }
      normalizedPhone = phoneValidation.normalized;
    }
    const normalizedEmail = email?.toLowerCase().trim();

    // Check if email/phone already has credentials
    if (normalizedEmail) {
      const existingEmail = await storage.getAuthCredentialsByEmail(normalizedEmail);
      if (existingEmail) {
        return res.status(409).json({ message: "Email already registered" });
      }
    }

    if (normalizedPhone) {
      const existingPhone = await storage.getAuthCredentialsByPhone(normalizedPhone);
      if (existingPhone) {
        return res.status(409).json({ message: "Phone number already registered" });
      }
    }

    // Check if user already exists with this email/phone
    let existingUser = null;
    if (normalizedEmail) {
      existingUser = await storage.getUserByEmailOrPhone(normalizedEmail);
    }
    if (!existingUser && normalizedPhone) {
      existingUser = await storage.getUserByEmailOrPhone(normalizedPhone);
    }

    let userId: string;

    if (existingUser) {
      // User exists, just add credentials
      userId = existingUser.id;
      
      // Check if they already have credentials
      const existingCreds = await storage.getAuthCredentialsByUserId(userId);
      if (existingCreds) {
        return res.status(409).json({ 
          message: "This account already has a password. Please use login instead." 
        });
      }
    } else {
      // Create new user
      const newUser = await storage.upsertUser({
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        firstName,
        lastName,
        role: "parent", // Default role for registration
      });
      userId = newUser.id;

      // Link to household if phone matches
      if (normalizedPhone) {
        await storage.relinkParentHouseholds(userId, normalizedPhone);
      }
    }

    // Hash password and create credentials (unverified by default)
    const passwordHash = await hashPassword(password);
    await storage.createAuthCredentials({
      userId,
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      isActive: true,
      emailVerified: false,
    });

    // Get full user details
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(500).json({ message: "Failed to create user" });
    }

    // Send verification email if email provided
    let verificationSent = false;
    if (normalizedEmail) {
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS);
      
      await storage.createEmailVerificationToken(userId, normalizedEmail, verificationToken, expiresAt);
      
      const baseUrl = process.env.APP_URL || `https://${req.get("host")}`;
      const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
      
      const { sendVerificationEmail } = await import("../services/email");
      const emailResult = await sendVerificationEmail(normalizedEmail, verificationUrl);
      verificationSent = emailResult.success;
      
      if (emailResult.success) {
        console.log(`[Auth] Verification email sent to ${normalizedEmail.substring(0, 3)}***`);
      } else {
        console.log(`[Auth] Verification email failed: ${emailResult.error}`);
      }
    }

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    // Set cookie for web browsers
    res.cookie(COOKIE_NAME, token, getCookieOptions(req));

    res.status(201).json({
      token,
      user: formatUserResponse(user),
      emailVerificationRequired: !!normalizedEmail && !verificationSent ? false : !!normalizedEmail,
      message: normalizedEmail ? "Please check your email to verify your account." : undefined,
    });
  } catch (error) {
    console.error("[Auth] Registration error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});

/**
 * GET /api/auth/user
 * Get current user info from JWT token (cookie or header)
 */
router.get("/user", async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const payload = verifyToken(token);
    if (!payload) {
      // Clear invalid cookie
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await storage.getUser(payload.userId);
    if (!user) {
      res.clearCookie(COOKIE_NAME);
      return res.status(404).json({ message: "User not found" });
    }

    // Verify account is still active
    const credentials = await storage.getAuthCredentialsByUserId(payload.userId);
    if (credentials && !credentials.isActive) {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ message: "Account is disabled" });
    }

    res.json(formatUserResponse(user));
  } catch (error) {
    console.error("[Auth] Get user error:", error);
    res.status(500).json({ message: "Failed to get user info" });
  }
});

/**
 * POST /api/auth/logout
 * Clear the auth cookie
 */
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ message: "Logged out successfully" });
});

/**
 * GET /api/auth/logout (for backward compatibility with browser navigation)
 */
router.get("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect("/");
});

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 */
router.post("/change-password", async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        message: "Invalid request", 
        errors: parsed.error.flatten().fieldErrors 
      });
    }

    const { currentPassword, newPassword } = parsed.data;

    // Get current credentials
    const credentials = await storage.getAuthCredentialsByUserId(payload.userId);
    if (!credentials) {
      return res.status(404).json({ message: "No password set for this account" });
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, credentials.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Update password
    const newHash = await hashPassword(newPassword);
    await storage.updateAuthCredentialsPassword(payload.userId, newHash);

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("[Auth] Change password error:", error);
    res.status(500).json({ message: "Failed to change password" });
  }
});

/**
 * Middleware: Require JWT authentication
 * Attaches user info to req.user
 * Also verifies the user's account is still active
 */
export const requireAuth: RequestHandler = async (req: any, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payload = verifyToken(token);
    if (!payload) {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(payload.userId);
    if (!user) {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Verify account is still active (check credentials status)
    const credentials = await storage.getAuthCredentialsByUserId(payload.userId);
    if (credentials && !credentials.isActive) {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ message: "Account is disabled" });
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;
    
    next();
  } catch (error) {
    console.error("[Auth] Auth middleware error:", error);
    res.status(401).json({ message: "Unauthorized" });
  }
};

/**
 * Middleware: Require specific role(s)
 * Also verifies the user's account is still active
 */
export function requireRole(...roles: ("admin" | "driver" | "parent")[]): RequestHandler {
  return async (req: any, res, next) => {
    try {
      const token = extractToken(req);
      if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const payload = verifyToken(token);
      if (!payload) {
        res.clearCookie(COOKIE_NAME);
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(payload.userId);
      if (!user) {
        res.clearCookie(COOKIE_NAME);
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Verify account is still active
      const credentials = await storage.getAuthCredentialsByUserId(payload.userId);
      if (credentials && !credentials.isActive) {
        res.clearCookie(COOKIE_NAME);
        return res.status(401).json({ message: "Account is disabled" });
      }

      if (!roles.includes(user.role as any)) {
        return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
      }

      // Attach user to request
      req.user = user;
      req.userId = user.id;
      
      next();
    } catch (error) {
      console.error("[Auth] Role middleware error:", error);
      res.status(401).json({ message: "Unauthorized" });
    }
  };
}

/**
 * Middleware: Require admin role OR lead driver status
 * Allows admins and drivers with isLeadDriver flag to access specific admin features
 */
export const requireAdminOrLeadDriver: RequestHandler = async (req: any, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payload = verifyToken(token);
    if (!payload) {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(payload.userId);
    if (!user) {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Verify account is still active
    const credentials = await storage.getAuthCredentialsByUserId(payload.userId);
    if (credentials && !credentials.isActive) {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ message: "Account is disabled" });
    }

    // Allow if admin OR lead driver
    const isAdmin = user.role === "admin";
    const isLeadDriver = user.role === "driver" && user.isLeadDriver === true;
    
    if (!isAdmin && !isLeadDriver) {
      return res.status(403).json({ message: "Forbidden: Requires admin or lead driver permissions" });
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;
    
    next();
  } catch (error) {
    console.error("[Auth] AdminOrLeadDriver middleware error:", error);
    res.status(401).json({ message: "Unauthorized" });
  }
};

// =========================
// Password Reset Endpoints
// =========================

// Schema for forgot password request
const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
});

// Schema for reset password request
const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Token expiration: 1 hour for password reset, 24 hours for email verification
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/auth/forgot-password
 * Request a password reset link
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        message: "Invalid request", 
        errors: parsed.error.flatten().fieldErrors 
      });
    }

    const { identifier } = parsed.data;
    
    // Find user by email or phone
    const user = await storage.getUserByEmailOrPhone(identifier);
    
    // Always respond with success to prevent user enumeration
    // Even if user not found, we don't reveal this
    if (!user) {
      console.log(`[Password Reset] No user found for identifier: ${identifier.substring(0, 3)}***`);
      return res.json({ 
        message: "If an account exists with this email/phone, you will receive reset instructions." 
      });
    }

    // Check if user has auth credentials
    const credentials = await storage.getAuthCredentialsByUserId(user.id);
    if (!credentials) {
      console.log(`[Password Reset] No credentials for user: ${user.id.substring(0, 8)}...`);
      return res.json({ 
        message: "If an account exists with this email/phone, you will receive reset instructions." 
      });
    }

    // Generate secure reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

    // Store the token
    await storage.createPasswordResetToken(user.id, token, expiresAt);

    // Build the reset URL
    const baseUrl = process.env.APP_URL || `https://${req.get("host")}`;
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    
    console.log(`[Password Reset] Token generated for user ${user.id.substring(0, 8)}...`);
    
    // Send password reset email if user has an email address
    if (user.email) {
      const { sendPasswordResetEmail } = await import("../services/email");
      const emailResult = await sendPasswordResetEmail(user.email, token, resetUrl);
      
      if (emailResult.success) {
        console.log(`[Password Reset] Email sent to ${user.email.substring(0, 3)}***`);
      } else {
        console.log(`[Password Reset] Email failed: ${emailResult.error}`);
      }
    } else {
      console.log(`[Password Reset] User has no email address`);
    }
    
    // In development, also include the token in response for testing
    const isDev = process.env.NODE_ENV !== "production";
    
    res.json({ 
      message: "If an account exists with this email/phone, you will receive reset instructions.",
      ...(isDev && { resetToken: token, resetUrl }),
    });
  } catch (error) {
    console.error("[Password Reset] Error:", error);
    res.status(500).json({ message: "Failed to process password reset request" });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
router.post("/reset-password", async (req, res) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        message: "Invalid request", 
        errors: parsed.error.flatten().fieldErrors 
      });
    }

    const { token, password } = parsed.data;

    // Look up the token
    const resetToken = await storage.getPasswordResetToken(token);
    
    if (!resetToken) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Check if already used
    if (resetToken.usedAt) {
      return res.status(400).json({ message: "This reset token has already been used" });
    }

    // Check if expired
    if (new Date() > resetToken.expiresAt) {
      return res.status(400).json({ message: "This reset token has expired" });
    }

    // Hash the new password
    const passwordHash = await hashPassword(password);

    // Update the password
    await storage.updateAuthCredentialsPassword(resetToken.userId, passwordHash);

    // Mark token as used
    await storage.markPasswordResetTokenUsed(token);

    // Get user for logging
    const user = await storage.getUser(resetToken.userId);
    console.log(`[Password Reset] Password successfully reset for user: ${user?.email || resetToken.userId.substring(0, 8)}...`);

    res.json({ message: "Password successfully reset. You can now log in with your new password." });
  } catch (error) {
    console.error("[Password Reset] Error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

/**
 * GET /api/auth/validate-reset-token
 * Check if a reset token is valid
 */
router.get("/validate-reset-token", async (req, res) => {
  try {
    const token = req.query.token as string;
    
    if (!token) {
      return res.status(400).json({ valid: false, message: "Token is required" });
    }

    const resetToken = await storage.getPasswordResetToken(token);
    
    if (!resetToken) {
      return res.json({ valid: false, message: "Invalid reset token" });
    }

    if (resetToken.usedAt) {
      return res.json({ valid: false, message: "This reset token has already been used" });
    }

    if (new Date() > resetToken.expiresAt) {
      return res.json({ valid: false, message: "This reset token has expired" });
    }

    res.json({ valid: true });
  } catch (error) {
    console.error("[Password Reset] Validate token error:", error);
    res.status(500).json({ valid: false, message: "Failed to validate token" });
  }
});

// =========================
// Email Verification Endpoints
// =========================

/**
 * POST /api/auth/verify-email
 * Verify email address using token
 */
router.post("/verify-email", async (req, res) => {
  try {
    const schema = z.object({
      token: z.string().min(1, "Verification token is required"),
    });
    
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        message: "Invalid request", 
        errors: parsed.error.flatten().fieldErrors 
      });
    }

    const { token } = parsed.data;

    // Look up the token
    const verificationToken = await storage.getEmailVerificationToken(token);
    
    if (!verificationToken) {
      return res.status(400).json({ message: "Invalid verification token" });
    }

    // Check if already used
    if (verificationToken.usedAt) {
      return res.status(400).json({ message: "This verification link has already been used" });
    }

    // Check if expired
    if (new Date() > verificationToken.expiresAt) {
      return res.status(400).json({ message: "This verification link has expired. Please request a new one." });
    }

    // Mark email as verified
    await storage.setEmailVerified(verificationToken.userId, true);

    // Mark token as used
    await storage.markEmailVerificationTokenUsed(token);

    // Get user for logging
    const user = await storage.getUser(verificationToken.userId);
    console.log(`[Email Verification] Email verified for user: ${user?.email || verificationToken.userId.substring(0, 8)}...`);

    res.json({ 
      success: true,
      message: "Email verified successfully! You can now access all features." 
    });
  } catch (error) {
    console.error("[Email Verification] Error:", error);
    res.status(500).json({ message: "Failed to verify email" });
  }
});

/**
 * GET /api/auth/verify-email
 * Verify email via GET request (for clicking link in email)
 */
router.get("/verify-email", async (req, res) => {
  try {
    const token = req.query.token as string;
    
    if (!token) {
      return res.redirect("/verify-email?error=missing_token");
    }

    // Look up the token
    const verificationToken = await storage.getEmailVerificationToken(token);
    
    if (!verificationToken) {
      return res.redirect("/verify-email?error=invalid_token");
    }

    // Check if already used
    if (verificationToken.usedAt) {
      return res.redirect("/verify-email?error=already_used");
    }

    // Check if expired
    if (new Date() > verificationToken.expiresAt) {
      return res.redirect("/verify-email?error=expired");
    }

    // Mark email as verified
    await storage.setEmailVerified(verificationToken.userId, true);

    // Mark token as used
    await storage.markEmailVerificationTokenUsed(token);

    // Get user for logging
    const user = await storage.getUser(verificationToken.userId);
    console.log(`[Email Verification] Email verified for user: ${user?.email || verificationToken.userId.substring(0, 8)}...`);

    res.redirect("/verify-email?success=true");
  } catch (error) {
    console.error("[Email Verification] Error:", error);
    res.redirect("/verify-email?error=server_error");
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email to authenticated user
 */
router.post("/resend-verification", async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Get user credentials
    const credentials = await storage.getAuthCredentialsByUserId(payload.userId);
    if (!credentials) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Check if already verified
    if (credentials.emailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    // Check if user has an email address
    const user = await storage.getUser(payload.userId);
    if (!user?.email) {
      return res.status(400).json({ message: "No email address associated with this account" });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS);
    
    await storage.createEmailVerificationToken(payload.userId, user.email, verificationToken, expiresAt);
    
    const baseUrl = process.env.APP_URL || `https://${req.get("host")}`;
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
    
    const { sendVerificationEmail } = await import("../services/email");
    const emailResult = await sendVerificationEmail(user.email, verificationUrl);
    
    if (emailResult.success) {
      console.log(`[Email Verification] Verification email resent to ${user.email.substring(0, 3)}***`);
      res.json({ message: "Verification email sent. Please check your inbox." });
    } else {
      console.log(`[Email Verification] Email failed: ${emailResult.error}`);
      res.status(500).json({ message: "Failed to send verification email. Please try again later." });
    }
  } catch (error) {
    console.error("[Email Verification] Resend error:", error);
    res.status(500).json({ message: "Failed to resend verification email" });
  }
});

/**
 * GET /api/auth/verification-status
 * Check email verification status for authenticated user
 */
router.get("/verification-status", async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const credentials = await storage.getAuthCredentialsByUserId(payload.userId);
    if (!credentials) {
      return res.json({ emailVerified: false, hasEmail: false });
    }

    const user = await storage.getUser(payload.userId);
    
    res.json({
      emailVerified: credentials.emailVerified || false,
      hasEmail: !!user?.email,
      emailVerifiedAt: credentials.emailVerifiedAt || null,
    });
  } catch (error) {
    console.error("[Email Verification] Status check error:", error);
    res.status(500).json({ message: "Failed to check verification status" });
  }
});

// =========================
// Test/Development Endpoints
// =========================

/**
 * POST /api/auth/test-login
 * TEST ONLY: Bypass login that works only in development mode
 * Allows automated testing to login as any role without password
 */
router.post("/test-login", async (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ message: "Test login disabled in production" });
  }

  try {
    const { role, userId } = req.body;
    
    if (!role || !["admin", "driver", "parent"].includes(role)) {
      return res.status(400).json({ message: "Valid role required: admin, driver, or parent" });
    }

    let user;
    
    if (userId) {
      // Login as specific user
      user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
    } else {
      // Find first user with the specified role
      const users = await storage.getUsersByRole(role);
      if (!users || users.length === 0) {
        return res.status(404).json({ message: `No ${role} users found` });
      }
      user = users[0];
    }

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    // Set cookie for web browsers
    res.cookie(COOKIE_NAME, token, getCookieOptions(req));

    console.log(`[Test Auth] Test login as ${user.role}: ${user.email || user.firstName}`);

    res.json({
      token,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("[Test Auth] Error:", error);
    res.status(500).json({ message: "Test login failed" });
  }
});

/**
 * GET /api/auth/test-users
 * TEST ONLY: Get sample users for each role (development only)
 */
router.get("/test-users", async (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ message: "Test endpoint disabled in production" });
  }

  try {
    const admins = await storage.getUsersByRole("admin");
    const drivers = await storage.getUsersByRole("driver");
    const parents = await storage.getUsersByRole("parent");

    res.json({
      admin: admins[0] ? { id: admins[0].id, email: admins[0].email, name: `${admins[0].firstName} ${admins[0].lastName}` } : null,
      driver: drivers[0] ? { id: drivers[0].id, email: drivers[0].email, name: `${drivers[0].firstName} ${drivers[0].lastName}` } : null,
      parent: parents[0] ? { id: parents[0].id, email: parents[0].email, name: `${parents[0].firstName} ${parents[0].lastName}` } : null,
    });
  } catch (error) {
    console.error("[Test Auth] Error fetching test users:", error);
    res.status(500).json({ message: "Failed to fetch test users" });
  }
});

export default router;
