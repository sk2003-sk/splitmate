import app from './app.js';
import { connectDb, disconnectDb } from './db.js';
import { env } from './config/env.js';
import { runDueRecurrings } from './services/recurring.service.js';

await connectDb();
console.log(`Connected to MongoDB at ${env.mongoUri.replace(/\/\/[^@]+@/, '//***@')}`);

const server = app.listen(env.port, () => {
  console.log(`SplitMate API listening on http://localhost:${env.port}`);
});

const recurringTimer = setInterval(async () => {
  try {
    const created = await runDueRecurrings();
    if (created) console.log(`Created ${created} recurring expense(s)`);
  } catch (error) {
    console.error('Recurring expense check failed:', error.message);
  }
}, 60_000);

async function shutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down…`);
  clearInterval(recurringTimer);
  server.close(async () => {
    await disconnectDb();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
