const { LifecycleError } = require("../services/resource-lifecycle");

function createProjectsRouter({ express, services, authenticateRequest }) {
  if (!express || typeof express.Router !== "function") throw new TypeError("Express is required.");
  if (!services) throw new TypeError("Lifecycle services are required.");
  if (typeof authenticateRequest !== "function")
    throw new TypeError("An authentication middleware is required.");

  const {
    createProjectSchema,
    deleteProjectSchema,
    projectRouteParamsSchema,
    updateProjectSchema,
  } = require("@astrelune/validation");

  const router = express.Router();
  router.use(authenticateRequest);

  function principal(req) {
    return req.authenticatedPrincipal;
  }

  router.post("/projects", async (req, res, next) => {
    try {
      const body = (function parse() {
        const result = createProjectSchema.safeParse(req.body);
        if (!result.success)
          throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
        return result.data;
      })();
      const project = await services.createProject(principal(req), body);
      return res.status(201).json({ data: { project } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/projects", async (req, res, next) => {
    try {
      const projects = await services.listProjects(principal(req));
      return res.status(200).json({ data: { projects } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/projects/:projectId", async (req, res, next) => {
    try {
      const params = (function parse() {
        const result = projectRouteParamsSchema.safeParse(req.params);
        if (!result.success)
          throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
        return result.data;
      })();
      const project = await services.getProject(principal(req), params.projectId);
      return res.status(200).json({ data: { project } });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/projects/:projectId", async (req, res, next) => {
    try {
      const params = (function parse() {
        const result = projectRouteParamsSchema.safeParse(req.params);
        if (!result.success)
          throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
        return result.data;
      })();
      const body = (function parse() {
        const result = updateProjectSchema.safeParse(req.body);
        if (!result.success)
          throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
        return result.data;
      })();
      const project = await services.updateProject(principal(req), params.projectId, body);
      return res.status(200).json({ data: { project } });
    } catch (error) {
      next(error);
    }
  });

  router.post("/projects/:projectId/archive", async (req, res, next) => {
    try {
      const params = (function parse() {
        const result = projectRouteParamsSchema.safeParse(req.params);
        if (!result.success)
          throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
        return result.data;
      })();
      const project = await services.archiveProject(principal(req), params.projectId);
      return res.status(200).json({ data: { project } });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/projects/:projectId", async (req, res, next) => {
    try {
      const params = (function parse() {
        const result = projectRouteParamsSchema.safeParse(req.params);
        if (!result.success)
          throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
        return result.data;
      })();
      const body = (function parse() {
        const result = deleteProjectSchema.safeParse(req.body);
        if (!result.success)
          throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
        return result.data;
      })();
      void body;
      await services.deleteProject(principal(req), params.projectId);
      return res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/projects/:projectId/documents", async (req, res, next) => {
    try {
      const params = (function parse() {
        const result = projectRouteParamsSchema.safeParse(req.params);
        if (!result.success)
          throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
        return result.data;
      })();
      const documents = await services.listDocuments(principal(req), params.projectId);
      return res.status(200).json({ data: { documents } });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = { createProjectsRouter };
