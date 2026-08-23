import { Pool } from "pg";

const pool = new Pool({
  // creates PostgreSQL connection pool
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// listening for pool errors
pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error: ", err);
});

// const query = (text, params) => {
//     return pool.query(text, params);
// };

const query = (text, params) => pool.query(text, params);

const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export default { pool, query, withTransaction };
