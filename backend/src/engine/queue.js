require('dotenv').config();
const { Queue } = require('bullmq');

function parseRedisUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port) || 6379,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: parseInt(u.pathname.slice(1)) || 0,
    maxRetriesPerRequest: null,
  };
}

const connection = parseRedisUrl(process.env.REDIS_URL || 'redis://localhost:6379');
const queue = new Queue('flow-timeouts', { connection });

module.exports = { queue, connection };
