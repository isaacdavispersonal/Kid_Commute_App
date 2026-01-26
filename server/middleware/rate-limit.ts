import rateLimit from "express-rate-limit";
import { logger } from "../logger";

const createRateLimiter = (
  windowMs: number,
  max: number,
  name: string
) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many requests, please try again later.",
      retryAfter: Math.ceil(windowMs / 1000),
    },
    handler: (req, res, _next, options) => {
      logger.warn(`[rate-limit] ${name} limit exceeded`, {
        ip: req.ip,
        path: req.path,
        limit: max,
        windowMs,
      });
      res.status(429).json(options.message);
    },
    validate: { xForwardedForHeader: false },
  });
};

export const authRateLimiter = createRateLimiter(
  15 * 60 * 1000,
  10,
  "auth"
);

export const registrationRateLimiter = createRateLimiter(
  60 * 60 * 1000,
  5,
  "registration"
);

export const passwordResetRateLimiter = createRateLimiter(
  15 * 60 * 1000,
  5,
  "password-reset"
);

export const announcementRateLimiter = createRateLimiter(
  60 * 1000,
  10,
  "announcement"
);
