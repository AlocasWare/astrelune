const path = require("node:path");
try {
  process.loadEnvFile(path.resolve(__dirname, "../../../.env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const express = require("express");
const { PrismaClient } = require("./generated/prisma");
const { createApiApp } = require("./app");
const { createLifecycleServices } = require("./services/resource-lifecycle");
const { createAuthenticationService } = require("./services/authentication");
const { createRegistrationService } = require("./services/registration");
const { createSessionAuthenticationMiddleware } = require("./middleware/authenticate-session");
const { createSessionService } = require("./services/sessions");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  process.stderr.write("DATABASE_URL is required to start Astrelune API.\n");
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const services = createLifecycleServices({
  prisma,
  authenticate: async (principal) => (principal?.userId ? { userId: principal.userId } : null),
  verifyRecentAuthentication: async (_principal, proof) => proof === "recent-auth-proof",
});
const registrationService = createRegistrationService({ prisma });
const sessionService = createSessionService({ prisma });
const authenticationService = createAuthenticationService({ prisma, sessionService });
const authenticateRequest = createSessionAuthenticationMiddleware({ prisma, sessionService });

const app = createApiApp({
  express,
  prisma,
  services,
  registrationService,
  authenticationService,
  authenticateRequest,
});
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
const server = app.listen(port, () => process.stdout.write(`Astrelune API listening on ${port}\n`));

function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
