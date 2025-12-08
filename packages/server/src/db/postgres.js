import pkg from 'pg';
const { Pool } = pkg;

export const pg = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'password',
  database: process.env.PG_DATABASE || 'bonk_chess'
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