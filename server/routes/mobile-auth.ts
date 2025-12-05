// Mobile authentication routes (JWT-based for Capacitor apps)
import { Router } from "express";
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

/**
 * POST /api/mobile/auth/login
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
      credentials = await storage.getAuthCredentialsByEmail(identifier);
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

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phoneNumber: user.phoneNumber,
        profileImageUrl: user.profileImageUrl,
      },
    });
  } catch (error) {
    console.error("[Mobile Auth] Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

/**
 * POST /api/mobile/auth/register
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
      // User exists (perhaps from OIDC), just add credentials
      userId = existingUser.id;
      
      // Check if they already have mobile credentials
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
        role: "parent", // Default role for mobile registration
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

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phoneNumber: user.phoneNumber,
        profileImageUrl: user.profileImageUrl,
      },
    });
  } catch (error) {
    console.error("[Mobile Auth] Registration error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});

/**
 * GET /api/mobile/auth/me
 * Get current user info from JWT token
 */
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    
    if (!payload) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await storage.getUser(payload.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phoneNumber: user.phoneNumber,
        profileImageUrl: user.profileImageUrl,
        address: user.address,
        isLeadDriver: user.isLeadDriver,
      },
    });
  } catch (error) {
    console.error("[Mobile Auth] Get user error:", error);
    res.status(500).json({ message: "Failed to get user info" });
  }
});

/**
 * POST /api/mobile/auth/change-password
 * Change password for authenticated user
 */
router.post("/change-password", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.substring(7);
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
    console.error("[Mobile Auth] Change password error:", error);
    res.status(500).json({ message: "Failed to change password" });
  }
});

export default router;
