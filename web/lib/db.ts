import postgres from "postgres";

const globalForDb = globalThis as unknown as { db: postgres.Sql };

// On Vercel each function instance keeps its own connections, so keep the pool small and let
// idle connections close instead of piling up on the database.
export const db = globalForDb.db ?? postgres(process.env.DATABASE_URL!, { max: 5, idle_timeout: 20, connect_timeout: 10 });

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
