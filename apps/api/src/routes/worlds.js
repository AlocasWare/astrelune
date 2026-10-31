const { LifecycleError } = require("../services/resource-lifecycle");

function createWorldsRouter({ express, services, authenticateRequest }) {
  if (!express || typeof express.Router !== "function") throw new TypeError("Express is required.");
  if (!services) throw new TypeError("Lifecycle services are required.");
  if (typeof authenticateRequest !== "function")
    throw new TypeError("An authentication middleware is required.");

  const {
    createWorldSchema,
    projectRouteParamsSchema,
    updateWorldEntrySchema,
    updateWorldSchema,
    worldRouteParamsSchema,
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

  router.post("/worlds", async (req, res, next) => {
    try {
      const body = parse(createWorldSchema, req.body);
      const world = await services.createWorld(principal(req), body);
      res.status(201).json({ data: { world } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/worlds", async (req, res, next) => {
    try {
      const worlds = await services.listWorlds(principal(req));
      res.status(200).json({ data: { worlds } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/worlds/:worldId", async (req, res, next) => {
    try {
      const params = parse(worldRouteParamsSchema, req.params);
      const world = await services.getWorld(principal(req), params.worldId);
      res.status(200).json({ data: { world } });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/worlds/:worldId", async (req, res, next) => {
    try {
      const params = parse(worldRouteParamsSchema, req.params);
      const body = parse(updateWorldSchema, req.body);
      const world = await services.updateWorld(principal(req), params.worldId, body);
      res.status(200).json({ data: { world } });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/worlds/:worldId", async (req, res, next) => {
    try {
      const params = parse(worldRouteParamsSchema, req.params);
      await services.deleteWorld(principal(req), params.worldId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post("/projects/:projectId/worlds/:worldId", async (req, res, next) => {
    try {
      const projectParams = parse(projectRouteParamsSchema, { projectId: req.params.projectId });
      const worldParams = parse(worldRouteParamsSchema, { worldId: req.params.worldId });
      const result = await services.linkWorldToProject(
        principal(req),
        projectParams.projectId,
        worldParams.worldId,
      );
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/projects/:projectId/worlds/:worldId", async (req, res, next) => {
    try {
      const projectParams = parse(projectRouteParamsSchema, { projectId: req.params.projectId });
      const worldParams = parse(worldRouteParamsSchema, { worldId: req.params.worldId });
      const result = await services.unlinkWorldFromProject(
        principal(req),
        projectParams.projectId,
        worldParams.worldId,
      );
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  });
  router.get("/worlds/:worldId/entries", async (req, res, next) => {
    try {
      const params = parse(worldRouteParamsSchema, req.params);
      const entries = await services.listWorldEntries(
        principal(req),
        params.worldId,
        req.query.kind,
      );
      res.status(200).json({ data: { entries } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/worlds/:worldId/entries/:entryId", async (req, res, next) => {
    try {
      const worldParams = parse(worldRouteParamsSchema, req.params);
      const entryId = req.params.entryId;
      if (typeof entryId !== "string" || !/^[0-9a-f-]{36}$/iu.test(entryId)) {
        throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
      }
      const entry = await services.getWorldEntry(principal(req), worldParams.worldId, entryId);
      res.status(200).json({ data: { entry } });
    } catch (error) {
      next(error);
    }
  });

  router.post("/worlds/:worldId/entries", async (req, res, next) => {
    try {
      const params = parse(worldRouteParamsSchema, req.params);
      const { createWorldEntrySchema } = require("@astrelune/validation");
      const body = parse(createWorldEntrySchema, req.body);
      const entry = await services.createWorldEntry(principal(req), params.worldId, body);
      res.status(201).json({ data: { entry } });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/worlds/:worldId/entries/:entryId", async (req, res, next) => {
    try {
      const worldParams = parse(worldRouteParamsSchema, req.params);
      const entryId = req.params.entryId;
      if (typeof entryId !== "string" || !/^[0-9a-f-]{36}$/iu.test(entryId)) {
        throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
      }
      const body = parse(updateWorldEntrySchema, req.body);
      const entry = await services.updateWorldEntry(
        principal(req),
        worldParams.worldId,
        entryId,
        body,
      );
      res.status(200).json({ data: { entry } });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/worlds/:worldId/entries/:entryId", async (req, res, next) => {
    try {
      const worldParams = parse(worldRouteParamsSchema, req.params);
      const entryId = req.params.entryId;
      if (typeof entryId !== "string" || !/^[0-9a-f-]{36}$/iu.test(entryId)) {
        throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
      }
      await services.deleteWorldEntry(principal(req), worldParams.worldId, entryId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post("/worlds/:worldId/relationships", async (req, res, next) => {
    try {
      const params = parse(worldRouteParamsSchema, req.params);
      const { createWorldEntryRelationshipSchema } = require("@astrelune/validation");
      const body = parse(createWorldEntryRelationshipSchema, req.body);
      const relationship = await services.createWorldEntryRelationship(
        principal(req),
        params.worldId,
        body,
      );
      res.status(201).json({ data: { relationship } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/worlds/:worldId/relationships", async (req, res, next) => {
    try {
      const params = parse(worldRouteParamsSchema, req.params);
      const relationships = await services.listWorldEntryRelationships(
        principal(req),
        params.worldId,
        req.query.entryId,
      );
      res.status(200).json({ data: { relationships } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/worlds/:worldId/relationships/:relationshipId", async (req, res, next) => {
    try {
      const worldParams = parse(worldRouteParamsSchema, req.params);
      const relationshipId = req.params.relationshipId;
      if (typeof relationshipId !== "string" || !/^[0-9a-f-]{36}$/iu.test(relationshipId)) {
        throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
      }
      const relationship = await services.getWorldEntryRelationship(
        principal(req),
        worldParams.worldId,
        relationshipId,
      );
      res.status(200).json({ data: { relationship } });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/worlds/:worldId/relationships/:relationshipId", async (req, res, next) => {
    try {
      const worldParams = parse(worldRouteParamsSchema, req.params);
      const relationshipId = req.params.relationshipId;
      if (typeof relationshipId !== "string" || !/^[0-9a-f-]{36}$/iu.test(relationshipId)) {
        throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
      }
      const { updateWorldEntryRelationshipSchema } = require("@astrelune/validation");
      const body = parse(updateWorldEntryRelationshipSchema, req.body);
      const relationship = await services.updateWorldEntryRelationship(
        principal(req),
        worldParams.worldId,
        relationshipId,
        body,
      );
      res.status(200).json({ data: { relationship } });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/worlds/:worldId/relationships/:relationshipId", async (req, res, next) => {
    try {
      const worldParams = parse(worldRouteParamsSchema, req.params);
      const relationshipId = req.params.relationshipId;
      if (typeof relationshipId !== "string" || !/^[0-9a-f-]{36}$/iu.test(relationshipId)) {
        throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
      }
      await services.deleteWorldEntryRelationship(
        principal(req),
        worldParams.worldId,
        relationshipId,
      );
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/worlds/:worldId/entries/:entryId/documents", async (req, res, next) => {
    try {
      const entryId = req.params.entryId;
      if (typeof entryId !== "string" || !/^[0-9a-f-]{36}$/iu.test(entryId)) {
        throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
      }
      const links = await services.listWorldEntryDocuments(principal(req), entryId);
      res.status(200).json({ data: { links } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createWorldsRouter };
