'use strict';

/**
 * Standalone Proxy Health Check Tool
 * Usage: node src/tools/proxyCheck.js
 */

const ProxyHealthChecker = require('../modules/proxyHealthChecker');
const EnvConfig = require('../envConfig');

async function main() {
  const envConfig = new EnvConfig();
  envConfig.loadEnv().parseCli();
  const config = envConfig.buildConfig();

  if (config.proxies.length === 0) {
    console.log('No proxies configured. Add PROXIES to .env file.');
    process.exit(1);
  }

  console.log(`Testing ${config.proxies.length} proxies...\n`);

  const checker = new ProxyHealthChecker({ maxLatency: 5000 });
  const results = await checker.checkAll(config.proxies, 5);

  console.log('\n=== RESULTS ===\n');

  const alive = results.filter(r => r.alive);
  const dead = results.filter(r => !r.alive);

  console.log(`ALIVE (${alive.length}):`);
  alive.sort((a, b) => a.latency - b.latency).forEach(r => {
    console.log(`  ✓ ${r.proxy} - ${r.latency}ms (score: ${r.score})`);
  });

  console.log(`\nDEAD (${dead.length}):`);
  dead.forEach(r => {
    console.log(`  ✗ ${r.proxy} - ${r.error}`);
  });

  const summary = checker.getSummary();
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total: ${summary.total} | Alive: ${summary.alive} | Dead: ${summary.dead} | Avg Latency: ${summary.avgLatency}ms`);
}

main().catch(err => { console.error(err); process.exit(1); });
