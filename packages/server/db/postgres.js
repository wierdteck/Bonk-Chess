import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

export const pg = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test connection and handle errors
pg.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err);
});

// Test initial connection
(async () => {
  try {
    const client = await pg.connect();
    console.log("✅ PostgreSQL connected successfully");
    client.release();
  } catch (err) {
    console.error("❌ PostgreSQL connection error:", err.message);
    console.log("Make sure PostgreSQL is running and credentials are correct");
  }
})();