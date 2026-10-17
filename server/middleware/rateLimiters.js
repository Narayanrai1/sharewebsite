const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisClient = require('../redis');

function createRedisStore(prefix) {
  return new RedisStore({
    prefix,
    sendCommand: (...args) => redisClient.sendCommand(args)
  });
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rate-limit:api:')
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login or registration attempts. Try again later.' },
  store: createRedisStore('rate-limit:auth:')
});

module.exports = { apiLimiter, authLimiter };