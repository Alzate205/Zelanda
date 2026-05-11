import { PrismaClient } from "@prisma/client";

// En desarrollo, Next.js recarga módulos con HMR y crearía múltiples
// instancias de PrismaClient (con sus pools de conexión) si no cacheamos
// la instancia en globalThis. En producción cada lambda tiene una sola.
const globalConPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalConPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalConPrisma.prisma = prisma;
}
