const path = require("node:path");
try {
  process.loadEnvFile(path.resolve(__dirname, "../../../.env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const { PrismaClient } = require("./generated/prisma");

const prisma = new PrismaClient();
prisma.$queryRaw`SELECT 1`
  .then(() => process.stdout.write("database: ok\n"))
  .catch((error) => {
    process.stderr.write(`database: unavailable (${error.code ?? "connection error"})\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
