// Unified authentication routes (JWT-based for both web and mobile)
import { Router, Request, Response, NextFunction, RequestHandler } from "express";
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

    // Hash password and create credentials
    const passwordHash = await hashPassword(password);
    await storage.createAuthCredentials({
      userId,
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      isActive: true,
    });

    // Get full user details
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(500).json({ message: "Failed to create user" });
    }

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    // Set cookie for web browsers
    res.cookie(COOKIE_NAME, token, getCookieOptions(req));

    res.status(201).json({
      token,
      user: formatUserResponse(user),
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
