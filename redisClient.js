// redisClient.js
// Redis client configuration and caching utilities

const redis = require('redis');
require('dotenv').config();

// Redis client configuration
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retry_strategy: function(options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      // End reconnecting on a specific error and flush all commands with a individual error
      return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      // End reconnecting after a specific timeout and flush all commands with a individual error
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      // End reconnecting with built in error
      return undefined;
    }
    // Reconnect after
    return Math.min(options.attempt * 100, 3000);
  }
});

// Connect to Redis
redisClient.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

redisClient.on('ready', () => {
  console.log('✅ Redis client ready');
});

// Cache utility functions
const cacheUtils = {
  // Set cache with TTL
  async set(key, value, ttl = 3600) {
    try {
      const serializedValue = JSON.stringify(value);
      await redisClient.setEx(key, ttl, serializedValue);
      console.log(`✅ Cached: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error(`❌ Cache set error for ${key}:`, error);
    }
  },

  // Get cache
  async get(key) {
    try {
      const value = await redisClient.get(key);
      if (value) {
        console.log(`✅ Cache hit: ${key}`);
        return JSON.parse(value);
      }
      console.log(`❌ Cache miss: ${key}`);
      return null;
    } catch (error) {
      console.error(`❌ Cache get error for ${key}:`, error);
      return null;
    }
  },

  // Delete cache
  async del(key) {
    try {
      await redisClient.del(key);
      console.log(`✅ Cache deleted: ${key}`);
    } catch (error) {
      console.error(`❌ Cache delete error for ${key}:`, error);
    }
  },

  // Check if key exists
  async exists(key) {
    try {
      return await redisClient.exists(key);
    } catch (error) {
      console.error(`❌ Cache exists error for ${key}:`, error);
      return false;
    }
  },

  // Set multiple keys
  async mset(keyValuePairs, ttl = 3600) {
    try {
      const pipeline = redisClient.multi();
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serializedValue = JSON.stringify(value);
        pipeline.setEx(key, ttl, serializedValue);
      }
      await pipeline.exec();
      console.log(`✅ Cached multiple keys: ${Object.keys(keyValuePairs).join(', ')}`);
    } catch (error) {
      console.error('❌ Cache mset error:', error);
    }
  },

  // Get multiple keys
  async mget(keys) {
    try {
      const values = await redisClient.mGet(keys);
      const result = {};
      keys.forEach((key, index) => {
        if (values[index]) {
          result[key] = JSON.parse(values[index]);
        }
      });
      return result;
    } catch (error) {
      console.error('❌ Cache mget error:', error);
      return {};
    }
  }
};

module.exports = {
  redisClient,
  cacheUtils
}; 