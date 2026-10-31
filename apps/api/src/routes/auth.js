const { loginSchema, registerUserSchema } = require("@astrelune/validation");
const { LifecycleError } = require("../services/resource-lifecycle");
const { EmailAlreadyExistsError } = require("../services/registration");
const { AuthenticationError } = require("../services/authentication");
const { createRateLimiter } = require("../middleware/security");
const authRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.ASTRELUNE_AUTH_RATE_LIMIT_MAX ?? 10),
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || "unknown",
});

const SESSION_COOKIE_NAME = "astrelune_session";

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}
function createAuthRouter({
  express,
  registrationService,
  authenticationService,
  authenticateRequest,
}) {
  if (!express || typeof express.Router !== "function") throw new TypeError("Express is required.");

  const router = express.Router();

  router.post("/register", authRateLimiter, async (req, res, next) => {
    try {
      const result = registerUserSchema.safeParse(req.body);
      if (!result.success) {
        throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
      }

      if (!registrationService || typeof registrationService.registerUser !== "function") {
        return res.status(503).json({
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Registration is unavailable.",
            requestId: req.requestId,
          },
        });
      }

      const user = await registrationService.registerUser(result.data);
      return res.status(201).json({ user });
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        return res.status(error.status).json({
          error: { code: error.code, message: error.message, requestId: req.requestId },
        });
      }
      next(error);
    }
  });

  router.post("/login", authRateLimiter, async (req, res, next) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
      }

      if (!authenticationService || typeof authenticationService.login !== "function") {
        return res.status(503).json({
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Authentication is unavailable.",
            requestId: req.requestId,
          },
        });
      }

      const { user, sessionToken, session } = await authenticationService.login(result.data);
      const cookieOptions = sessionCookieOptions();
      if (session?.expiresAt) cookieOptions.expires = new Date(session.expiresAt);
      res.cookie(SESSION_COOKIE_NAME, sessionToken, cookieOptions);
      return res.status(200).json({ user });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return res.status(error.status).json({
          error: { code: error.code, message: error.message, requestId: req.requestId },
        });
      }
      next(error);
    }
  });

  router.post("/logout", async (req, res, next) => {
    try {
      const authorization = req.get("authorization");
      const bearerToken =
        typeof authorization === "string" && authorization.startsWith("Bearer ")
          ? authorization.slice("Bearer ".length).trim()
          : null;
      const bodyToken = typeof req.body?.token === "string" ? req.body.token : null;
      const sessionToken = bearerToken || bodyToken;

      if (authenticationService && typeof authenticationService.logout === "function") {
        await authenticationService.logout(sessionToken);
      }

      res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
      return res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", async (req, res, next) => {
    try {
      if (typeof authenticateRequest !== "function") {
        return res.status(503).json({
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Authentication is unavailable.",
            requestId: req.requestId,
          },
        });
      }

      await authenticateRequest(req, res, async () => {
        if (!req.user) {
          return res.status(401).json({
            error: {
              code: "INVALID_SESSION",
              message: "Authentication is required.",
              requestId: req.requestId,
            },
          });
        }
        return res.status(200).json({ user: req.user });
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createAuthRouter };
