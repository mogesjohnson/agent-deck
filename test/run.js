'use strict';
// Runs every test/*.test.js with node:test without relying on shell globs (PowerShell safe).
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith('.test.js'))
  .sort()
  .map((f) => path.join(__dirname, f));
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
