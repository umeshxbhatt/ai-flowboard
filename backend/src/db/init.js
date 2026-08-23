import "dotenv/config";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { pool } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    console.log("Applying schema...");
    await pool.query(sql);
    console.log("Schema applied successfully.");
  } catch (err) {
    console.log("Failed to apply schema: ", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
