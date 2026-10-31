const { LifecycleError } = require("../services/resource-lifecycle");

function createPreferencesRouter({ express, services, authenticateRequest }) {
  if (!express || typeof express.Router !== "function") throw new TypeError("Express is required.");
  if (!services) throw new TypeError("Lifecycle services are required.");
  if (typeof authenticateRequest !== "function")
    throw new TypeError("An authentication middleware is required.");

  const { updateUserPreferencesSchema } = require("@astrelune/validation");

  const router = express.Router();
  router.use(authenticateRequest);

  function principal(req) {
    return req.authenticatedPrincipal;
  }

  function parse(schema, value) {
    const result = schema.safeParse(value);
    if (!result.success)
      throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
    return result.data;
  }

  router.get("/preferences", async (req, res, next) => {
    try {
      const preferences = await services.getUserPreferences(principal(req));
      res.status(200).json({ data: { preferences } });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/preferences", async (req, res, next) => {
    try {
      const body = parse(updateUserPreferencesSchema, req.body);
      const preferences = await services.updateUserPreferences(principal(req), body);
      res.status(200).json({ data: { preferences } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createPreferencesRouter };
