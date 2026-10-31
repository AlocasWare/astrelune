const { randomUUID } = require("node:crypto");
const { createDeletionRouter } = require("./routes/deletion");
const { LifecycleError } = require("./services/resource-lifecycle");

const { createAuthRouter } = require("./routes/auth");
const { createPreferencesRouter } = require("./routes/preferences");
const { createProjectsRouter } = require("./routes/projects");
const { createGoalsRouter } = require("./routes/goals");
const { createWorldsRouter } = require("./routes/worlds");

const { createOriginValidationMiddleware } = require("./middleware/security");

function createApiApp({
  express,
  services,
  authenticateRequest,
  prisma,
  registrationService,
  authenticationService,
}) {
  if (!express || typeof express !== "function") throw new TypeError("Express is required.");
  const app = express();
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader("x-request-id", req.requestId);
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "content-type, x-requested-with");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      if (req.method === "OPTIONS") return res.status(204).end();
    }
    next();
  });
  app.use(createOriginValidationMiddleware({ allowedOrigins }));
  app.get("/health/live", (_req, res) => res.status(200).json({ status: "ok" }));
  app.get("/health/db", async (_req, res) => {
    if (!prisma) return res.status(503).json({ status: "error", database: "unavailable" });
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.status(200).json({ status: "ok", database: "ok" });
    } catch {
      return res.status(503).json({ status: "error", database: "unavailable" });
    }
  });
  app.use(
    "/auth",
    createAuthRouter({ express, registrationService, authenticationService, authenticateRequest }),
  );
  app.use("/api/v1", createPreferencesRouter({ express, services, authenticateRequest }));
  app.use("/preferences", createPreferencesRouter({ express, services, authenticateRequest }));
  app.use("/api/v1", createProjectsRouter({ express, services, authenticateRequest }));
  app.use("/projects", createProjectsRouter({ express, services, authenticateRequest }));
  app.use("/projects", createProjectsRouter({ express, services, authenticateRequest }));
  app.use("/api/v1", createGoalsRouter({ express, services, authenticateRequest }));
  app.use("/goals", createGoalsRouter({ express, services, authenticateRequest }));
  app.use("/api/v1", createWorldsRouter({ express, services, authenticateRequest }));
  app.use("/worlds", createWorldsRouter({ express, services, authenticateRequest }));
  app.use("/api/v1", createDeletionRouter({ express, services, authenticateRequest }));
  app.use("/api/v1", (req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Resource not found.", requestId: req.requestId },
    });
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const known = error instanceof LifecycleError;
    const tooLarge = error.type === "entity.too.large";
    const status = known
      ? error.status
      : error.type === "entity.parse.failed"
        ? 400
        : tooLarge
          ? 413
          : Number.isInteger(error.status)
            ? error.status
            : 500;
    const code = known
      ? error.code
      : error.type === "entity.parse.failed"
        ? "MALFORMED_JSON"
        : tooLarge
          ? "REQUEST_TOO_LARGE"
          : "INTERNAL_ERROR";
    const message = known
      ? error.message
      : code === "MALFORMED_JSON"
        ? "Request body must contain valid JSON."
        : code === "REQUEST_TOO_LARGE"
          ? "Request body exceeds the size limit."
          : "An unexpected error occurred.";
    res.status(status).json({ error: { code, message, requestId: req.requestId } });
  });
  return app;
}

module.exports = { createApiApp };
