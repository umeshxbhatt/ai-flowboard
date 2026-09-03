import "dotenv/config"; // Loads variables from .env

import fs from "fs"; // fs stands for File System used to read/write files 
import path from "path"; // path is a Node.js module that helps us create file paths correctly
import { fileURLToPath } from "url"; // to convert a file URL into a normal file path

import { pool } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url); // Give me the full path of the current file (init.js)
const __dirname = path.dirname(__filename); // Give me the directory of the current file (init.js)

// Immediately Invoked Function Expression (IIFE)
// Create a function and run it immediately
(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"); // creating full path to schema.sql file and read this file as normal text 
    console.log("Applying schema...");
    await pool.query(sql); // Send this SQL code (schema.sql) to PostgreSQL
    console.log("Schema applied successfully."); // PostgreSQL successfully executes the SQL
  } catch (err) {
    console.log("Failed to apply schema: ", err.message);
    process.exitCode = 1; // tells Node: The script failed, 0 generally means success, A non-zero value means failure.
  } finally {
    await pool.end(); // Close the database connections managed by this pool
  }
})();
