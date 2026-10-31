const { ACCOUNT_DELETE_CONFIRMATION, LifecycleError } = require("../services/resource-lifecycle");
const {
  deleteAccountSchema,
  deleteDocumentSchema,
  deleteProjectSchema,
  deleteWorldSchema,
  createDocumentSchema,
  createProjectSchema,
  createWorldEntrySchema,
  createWorldSchema,
  documentRouteParamsSchema,
  moveDocumentSchema,
  projectRouteParamsSchema,
  saveDocumentSchema,
  worldRouteParamsSchema,
} = require("@astrelune/validation");

function parseRequest(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
  return result.data;
}

function createDeletionRouter({ express, services, authenticateRequest }) {
  if (!express || typeof express.Router !== "function") throw new TypeError("Express is required.");
  if (!services) throw new TypeError("Lifecycle services are required.");
  if (typeof authenticateRequest !== "function")
    throw new TypeError("An authentication middleware is required.");

  const router = express.Router();
  router.use(authenticateRequest);

  const deletion = (serviceCall) => async (req, res, next) => {
    try {
      const principal = req.authenticatedPrincipal;
      if (!principal) throw new LifecycleError("UNAUTHENTICATED", 401);
      await serviceCall(principal, req);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };

  const jsonAction = (status, serviceCall, responseKey) => async (req, res, next) => {
    try {
      const principal = req.authenticatedPrincipal;
      if (!principal) throw new LifecycleError("UNAUTHENTICATED", 401);
      const value = await serviceCall(principal, req);
      res.status(status).json({ data: { [responseKey]: value } });
    } catch (error) {
      next(error);
    }
  };

  router.post(
    "/projects",
    jsonAction(
      201,
      (principal, req) =>
        services.createProject(principal, parseRequest(createProjectSchema, req.body)),
      "project",
    ),
  );
  router.post(
    "/worlds",
    jsonAction(
      201,
      (principal, req) =>
        services.createWorld(principal, parseRequest(createWorldSchema, req.body)),
      "world",
    ),
  );
  router.post(
    "/projects/:projectId/documents",
    jsonAction(
      201,
      (principal, req) => {
        const { projectId } = parseRequest(projectRouteParamsSchema, req.params);
        return services.createDocument(
          principal,
          projectId,
          parseRequest(createDocumentSchema, req.body),
        );
      },
      "document",
    ),
  );
  router.post(
    "/worlds/:worldId/entries",
    jsonAction(
      201,
      (principal, req) => {
        const { worldId } = parseRequest(worldRouteParamsSchema, req.params);
        return services.createWorldEntry(
          principal,
          worldId,
          parseRequest(createWorldEntrySchema, req.body),
        );
      },
      "entry",
    ),
  );
  router.get("/documents/:documentId/content", async (req, res, next) => {
    try {
      const principal = req.authenticatedPrincipal;
      if (!principal) throw new LifecycleError("UNAUTHENTICATED", 401);
      const { documentId } = parseRequest(documentRouteParamsSchema, req.params);
      const document = await services.getDocumentContent(principal, documentId);
      res.status(200).json({ document });
    } catch (error) {
      next(error);
    }
  });
  router.put("/documents/:documentId/content", async (req, res, next) => {
    try {
      const principal = req.authenticatedPrincipal;
      if (!principal) throw new LifecycleError("UNAUTHENTICATED", 401);
      const { documentId } = parseRequest(documentRouteParamsSchema, req.params);
      const body = parseRequest(saveDocumentSchema, req.body);
      const requestKey = req.get("Idempotency-Key");
      if (!requestKey) throw new LifecycleError("IDEMPOTENCY_KEY_REQUIRED", 400);
      const result = await services.saveDocument(principal, documentId, body, requestKey);
      res.status(200).json({ document: result.document, saveStatus: result.saveStatus });
    } catch (error) {
      next(error);
    }
  });

  router.delete(
    "/account",
    deletion((principal, req) => {
      const body = parseRequest(deleteAccountSchema, req.body);
      return services.deleteUserAccount(principal, {
        confirmation:
          body.confirmation === ACCOUNT_DELETE_CONFIRMATION
            ? ACCOUNT_DELETE_CONFIRMATION
            : undefined,
        reauthenticationProof: body.password,
      });
    }),
  );
  router.delete(
    "/projects/:projectId",
    deletion((principal, req) => {
      const { projectId } = parseRequest(projectRouteParamsSchema, req.params);
      parseRequest(deleteProjectSchema, req.body);
      return services.deleteProject(principal, projectId);
    }),
  );
  router.delete(
    "/documents/:documentId",
    deletion((principal, req) => {
      const { documentId } = parseRequest(documentRouteParamsSchema, req.params);
      parseRequest(deleteDocumentSchema, req.body);
      return services.deleteDocumentSubtree(principal, documentId);
    }),
  );
  router.delete(
    "/worlds/:worldId",
    deletion((principal, req) => {
      const { worldId } = parseRequest(worldRouteParamsSchema, req.params);
      parseRequest(deleteWorldSchema, req.body);
      return services.deleteWorld(principal, worldId);
    }),
  );
  router.post("/documents/:documentId/world-entries", async (req, res, next) => {
    try {
      const principal = req.authenticatedPrincipal;
      if (!principal) throw new LifecycleError("UNAUTHENTICATED", 401);
      const { documentId } = parseRequest(documentRouteParamsSchema, req.params);
      const worldEntryId = req.body?.worldEntryId;
      if (typeof worldEntryId !== "string" || !/^[0-9a-f-]{36}$/iu.test(worldEntryId)) {
        throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
      }
      const relationshipType =
        typeof req.body?.relationshipType === "string"
          ? req.body.relationshipType.trim()
          : "REFERENCES";
      const result = await services.linkDocumentToWorldEntry(
        principal,
        documentId,
        worldEntryId,
        relationshipType,
      );
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  router.get("/documents/:documentId/world-entries", async (req, res, next) => {
    try {
      const principal = req.authenticatedPrincipal;
      if (!principal) throw new LifecycleError("UNAUTHENTICATED", 401);
      const { documentId } = parseRequest(documentRouteParamsSchema, req.params);
      const links = await services.listDocumentWorldEntries(principal, documentId);
      res.status(200).json({ data: { links } });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/documents/:documentId/world-entries/:worldEntryId", async (req, res, next) => {
    try {
      const principal = req.authenticatedPrincipal;
      if (!principal) throw new LifecycleError("UNAUTHENTICATED", 401);
      const { documentId } = parseRequest(documentRouteParamsSchema, req.params);
      const worldEntryId = req.params.worldEntryId;
      if (typeof worldEntryId !== "string" || !/^[0-9a-f-]{36}$/iu.test(worldEntryId)) {
        throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
      }
      const relationshipType =
        typeof req.query.relationshipType === "string" ? req.query.relationshipType : "REFERENCES";
      const result = await services.unlinkDocumentFromWorldEntry(
        principal,
        documentId,
        worldEntryId,
        relationshipType,
      );
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/documents/:documentId", async (req, res, next) => {
    try {
      const principal = req.authenticatedPrincipal;
      if (!principal) throw new LifecycleError("UNAUTHENTICATED", 401);
      const { documentId } = parseRequest(documentRouteParamsSchema, req.params);
      const body = parseRequest(moveDocumentSchema, req.body);
      await services.moveDocument(principal, documentId, {
        parentId: body.parentId,
        position: body.position,
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post("/documents/:documentId/duplicate", async (req, res, next) => {
    try {
      const principal = req.authenticatedPrincipal;
      if (!principal) throw new LifecycleError("UNAUTHENTICATED", 401);
      const { documentId } = parseRequest(documentRouteParamsSchema, req.params);
      const document = await services.duplicateDocument(principal, documentId);
      return res.status(201).json({ data: { document } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/documents/:documentId/revisions", async (req, res, next) => {
    try {
      const principal = req.authenticatedPrincipal;
      if (!principal) throw new LifecycleError("UNAUTHENTICATED", 401);
      const { documentId } = parseRequest(documentRouteParamsSchema, req.params);
      const revisions = await services.listDocumentRevisions(principal, documentId);
      return res.status(200).json({ data: { revisions } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/documents/:documentId/revisions/compare", async (req, res, next) => {
    try {
      const principal = req.authenticatedPrincipal;
      if (!principal) throw new LifecycleError("UNAUTHENTICATED", 401);
      const params = parseRequest(documentRouteParamsSchema, req.params);
      const from = req.query.from;
      const to = req.query.to;
      if (
        typeof from !== "string" ||
        typeof to !== "string" ||
        !/^[0-9a-f-]{36}$/iu.test(from) ||
        !/^[0-9a-f-]{36}$/iu.test(to)
      ) {
        throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
      }
      const comparison = await services.compareDocumentRevisions(
        principal,
        params.documentId,
        from,
        to,
      );
      return res.status(200).json({ data: comparison });
    } catch (error) {
      next(error);
    }
  });

  router.get("/documents/:documentId/revisions/:revisionId", async (req, res, next) => {
    try {
      const principal = req.authenticatedPrincipal;
      if (!principal) throw new LifecycleError("UNAUTHENTICATED", 401);
      const params = parseRequest(documentRouteParamsSchema, req.params);
      const revisionId = req.params.revisionId;
      if (typeof revisionId !== "string" || !/^[0-9a-f-]{36}$/iu.test(revisionId)) {
        throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
      }
      const revision = await services.getDocumentRevision(principal, params.documentId, revisionId);
      return res.status(200).json({ data: { revision } });
    } catch (error) {
      next(error);
    }
  });

  router.post("/documents/:documentId/revisions/:revisionId/restore", async (req, res, next) => {
    try {
      const principal = req.authenticatedPrincipal;
      if (!principal) throw new LifecycleError("UNAUTHENTICATED", 401);
      const params = parseRequest(documentRouteParamsSchema, req.params);
      const revisionId = req.params.revisionId;
      if (typeof revisionId !== "string" || !/^[0-9a-f-]{36}$/iu.test(revisionId)) {
        throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
      }
      const requestKey = req.get("Idempotency-Key");
      if (!requestKey) throw new LifecycleError("IDEMPOTENCY_KEY_REQUIRED", 400);
      const contentVersion = req.body?.contentVersion;
      if (!Number.isInteger(contentVersion) || contentVersion < 0) {
        throw new LifecycleError("VALIDATION_ERROR", 422, "Request validation failed.");
      }
      const result = await services.restoreDocumentRevision(
        principal,
        params.documentId,
        revisionId,
        requestKey,
        contentVersion,
      );
      return res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createDeletionRouter };
