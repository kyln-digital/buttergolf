#!/usr/bin/env tsx
/**
 * Redis keepalive script - prevents deletion due to inactivity
 * Run: npx tsx scripts/redis-keepalive.ts
 *
 * Automatically loads REDIS_URL from apps/web/.env.local
 */

import { Redis } from "ioredis";
import * as fs from "fs";
import * as path from "path";

// Load .env.local from apps/web
const envPath = path.resolve(__dirname, "../apps/web/.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, ""); // Remove quotes
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
  console.log(`📁 Loaded env from ${envPath}`);
}

async function keepalive() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.error("❌ REDIS_URL not found in apps/web/.env.local or environment");
    process.exit(1);
  }

  console.log("🔗 Connecting to Redis...");

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
  });

  try {
    // Set a keepalive key with 30-day expiry
    const key = "buttergolf:keepalive";
    const value = new Date().toISOString();

    await redis.setex(key, 60 * 60 * 24 * 30, value); // 30 days TTL

    console.log(`✅ Set keepalive key: ${key}`);
    console.log(`   Value: ${value}`);
    console.log(`   TTL: 30 days`);

    // Verify it was written
    const stored = await redis.get(key);
    console.log(`✅ Verified read: ${stored}`);

    // Show some stats
    const info = await redis.info("memory");
    const usedMemory = info.match(/used_memory_human:(\S+)/)?.[1] || "unknown";
    console.log(`📊 Redis memory usage: ${usedMemory}`);
  } catch (error) {
    console.error("❌ Redis error:", error);
    process.exit(1);
  } finally {
    await redis.quit();
    console.log("\n👋 Disconnected from Redis");
  }
}

keepalive();
