#!/usr/bin/env node
/**
 * One-command project setup (no Docker required):
 *   npm run setup
 *
 * 1. Installs workspace dependencies
 * 2. Creates apps/api/.env
 * 3. Builds plugin + API
 *
 * PostgreSQL must be set up first — see docs/SETUP-POSTGRES-PGADMIN.md
 * Then run: npm run db:migrate
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root });
}

function main() {
  console.log('=== Call Log Sync System — Setup ===\n');

  run('npm install');

  const envExample = path.join(root, 'apps', 'api', '.env.example');
  const secretsApiEnv = path.join(root, 'secrets', 'api.env');
  const envTarget = path.join(root, 'apps', 'api', '.env');
  if (!fs.existsSync(envTarget) && fs.existsSync(secretsApiEnv)) {
    fs.copyFileSync(secretsApiEnv, envTarget);
    console.log('\nCreated apps/api/.env from secrets/api.env');
  } else if (!fs.existsSync(envTarget) && fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, envTarget);
    console.log('\nCreated apps/api/.env from .env.example');
    console.log('Edit apps/api/.env with your PostgreSQL credentials from pgAdmin 4.');
  }

  const secretsNgrok = path.join(root, 'secrets', 'ngrok.env');
  const ngrokTarget = path.join(root, '.env.ngrok');
  if (!fs.existsSync(ngrokTarget) && fs.existsSync(secretsNgrok)) {
    fs.copyFileSync(secretsNgrok, ngrokTarget);
    console.log('Created .env.ngrok from secrets/ngrok.env');
  }

  run('npm run build -w @call-log/plugin');
  run('npm run build -w @call-log/api');

  console.log('\n=== Setup Complete ===\n');
  console.log('NEXT STEPS:');
  console.log('  1. Set up PostgreSQL in pgAdmin 4 (see docs/SETUP-POSTGRES-PGADMIN.md)');
  console.log('  2. Or sync env:       npm run sync:secrets');
  console.log('  3. Run migrations:  npm run db:migrate');
  console.log('  4. Start dev:        npm run dev');
  console.log('');
  console.log('Dashboard:  http://localhost:5173');
  console.log('API:        http://localhost:3000');
  console.log('Admin:      admin@enterprise.com / admin123');
}

main();
