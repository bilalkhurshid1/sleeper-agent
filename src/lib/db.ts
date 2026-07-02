import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const filename = dbUrl.startsWith("file:")
  ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), dbUrl.slice("file:".length))
  : dbUrl;

declare global {
  var __prisma: PrismaClient | undefined;
  var __prismaConstructor: typeof PrismaClient | undefined;
  var __prismaFilename: string | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${filename}` }),
  });
}

if (
  process.env.NODE_ENV !== "production" &&
  globalThis.__prisma &&
  (globalThis.__prismaConstructor !== PrismaClient || globalThis.__prismaFilename !== filename)
) {
  void globalThis.__prisma.$disconnect().catch(() => undefined);
  globalThis.__prisma = undefined;
}

export const prisma =
  process.env.NODE_ENV !== "production" && globalThis.__prisma
    ? globalThis.__prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
  globalThis.__prismaConstructor = PrismaClient;
  globalThis.__prismaFilename = filename;
}
