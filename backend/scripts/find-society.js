import dotenv from "dotenv"; dotenv.config();
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(
  `SELECT id, name, building_id FROM societies WHERE LOWER(name) LIKE '%sun%' OR building_id = 'BLD-QGYVAK' ORDER BY id DESC`,
);
console.log(JSON.stringify(r.rows, null, 2));
await c.end();
