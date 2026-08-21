import { Pool } from "pg";
const p = new Pool({ connectionString: process.env.DATABASE_URL });
const r = await p.query("SELECT name, status FROM leads ORDER BY \"createdAt\" DESC LIMIT 8");
console.log("Current lead statuses:");
r.rows.forEach((l: any) => console.log(" ", l.name.padEnd(24), l.status));
await p.end();
