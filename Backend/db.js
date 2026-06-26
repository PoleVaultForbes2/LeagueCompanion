// Provides the shared Supabase/PostgreSQL connection pool used by backend routes and services.
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString =
  process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const isLocalDatabase =
  !connectionString || /localhost|127\.0\.0\.1/i.test(connectionString);

const pool = new pg.Pool({
  connectionString,
  ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
});

export default pool;
