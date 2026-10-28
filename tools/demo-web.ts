// Set variables in Node rather than using shell-specific assignment syntax.
// Keep simulated participants in their own loopback-only database.
process.env.DEMO_MODE = 'true';
process.env.DB_PATH = 'data/demo.sqlite';
process.env.HOST = '127.0.0.1';
await import('../services/coordinator/src/main.ts');
