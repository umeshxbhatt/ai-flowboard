import { Pool } from "pg";

export const pool = new Pool({
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

export const query = (text, params) => pool.query(text, params);

export const withTransaction = async (callback) => {
  const client = await pool.connect(); // give me one database connection from pool and store it in client
  try {
    await client.query("BEGIN");

    const result = await callback(client);

    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release(); // We borrowed a connection now return this connection to the pool
  }
};