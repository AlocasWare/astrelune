const { LifecycleError } = require("../services/resource-lifecycle");

function createGoalsRouter({ express, services, authenticateRequest }) {
  if (!express || typeof express.Router !== "function") throw new TypeError("Express is required.");
  if (!services) throw new TypeError("Lifecycle services are required.");
  if (typeof authenticateRequest !== "function")
    throw new TypeError("An authentication middleware is required.");

  const {
    activityQuerySchema,
    createWritingActivitySchema,
    createWritingGoalSchema,
    goalRouteParamsSchema,
    updateWritingGoalSchema,
  } = require("@astrelune/validation");

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

  router.get("/goals", async (req, res, next) => {
    try {
      const goals = await services.listWritingGoals(principal(req));
      res.status(200).json({ data: { goals } });
    } catch (error) {
      next(error);
    }
  });

  router.post("/goals", async (req, res, next) => {
    try {
      const body = parse(createWritingGoalSchema, req.body);
      const goal = await services.createWritingGoal(principal(req), body);
      res.status(201).json({ data: { goal } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/goals/:goalId", async (req, res, next) => {
    try {
      const params = parse(goalRouteParamsSchema, req.params);
      const goal = await services.getWritingGoal(principal(req), params.goalId);
      res.status(200).json({ data: { goal } });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/goals/:goalId", async (req, res, next) => {
    try {
      const params = parse(goalRouteParamsSchema, req.params);
      const body = parse(updateWritingGoalSchema, req.body);
      const goal = await services.updateWritingGoal(principal(req), params.goalId, body);
      res.status(200).json({ data: { goal } });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/goals/:goalId", async (req, res, next) => {
    try {
      const params = parse(goalRouteParamsSchema, req.params);
      await services.deleteWritingGoal(principal(req), params.goalId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/goals/:goalId/progress", async (req, res, next) => {
    try {
      const params = parse(goalRouteParamsSchema, req.params);
      const progress = await services.getWritingGoalProgress(principal(req), params.goalId);
      res.status(200).json({ data: { progress } });
    } catch (error) {
      next(error);
    }
  });

  router.post("/activity", async (req, res, next) => {
    try {
      const body = parse(createWritingActivitySchema, req.body);
      const activity = await services.recordWritingActivity(principal(req), body);
      res.status(201).json({ data: { activity } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/activity", async (req, res, next) => {
    try {
      const filters = parse(activityQuerySchema, req.query);
      const activity = await services.listWritingActivity(principal(req), filters);
      res.status(200).json({ data: { activity } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createGoalsRouter };
