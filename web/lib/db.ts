import postgres from "postgres";

const globalForDb = globalThis as unknown as { db: postgres.Sql };

export const db = globalForDb.db ?? postgres(process.env.DATABASE_URL!);

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
