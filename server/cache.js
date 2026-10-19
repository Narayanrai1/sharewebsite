const redisClient = require('./redis');

async function getCache(key) {
  const cached = await redisClient.get(key);
  return cached ? JSON.parse(cached) : null;
}

async function setCache(key, value, ttlSeconds) {
  await redisClient.set(key, JSON.stringify(value), {
    EX: ttlSeconds
  });
}

module.exports = { getCache, setCache };