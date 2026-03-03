#!/usr/bin/env node
/**
 * i18n Coverage Check
 * Compares EN and AR translation files and scans source code for t() calls
 * to detect missing keys.
 *
 * Usage: node scripts/i18n-coverage.mjs
 * Exit code 0 = pass, 1 = missing keys found
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LOCALES_DIR = join(ROOT, 'src', 'i18n', 'locales');
const SRC_DIR = join(ROOT, 'src');

// ── Load locale files ────────────────────────────────────────────────
function flattenKeys(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      return { ...acc, ...flattenKeys(v, key) };
    }
    acc[key] = v;
    return acc;
  }, {});
}

const en = flattenKeys(JSON.parse(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf-8')));
const ar = flattenKeys(JSON.parse(readFileSync(join(LOCALES_DIR, 'ar.json'), 'utf-8')));

const enKeys = new Set(Object.keys(en));
const arKeys = new Set(Object.keys(ar));

// ── Scan source for t() calls ────────────────────────────────────────
const tCallRegex = /\bt\(\s*['"`]([a-zA-Z0-9_.]+)['"`]/g;
const usedKeys = new Set();

function walkDir(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!['node_modules', '.next', 'locales'].includes(entry)) walkDir(full);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      const src = readFileSync(full, 'utf-8');
      let m;
      while ((m = tCallRegex.exec(src)) !== null) usedKeys.add(m[1]);
    }
  }
}

walkDir(SRC_DIR);

// ── Report ───────────────────────────────────────────────────────────
let issues = 0;

// Keys in EN but missing in AR
const missingAr = [...enKeys].filter(k => !arKeys.has(k));
if (missingAr.length) {
  console.log(`\n❌ Keys in EN but missing in AR (${missingAr.length}):`);
  missingAr.forEach(k => console.log(`   - ${k}`));
  issues += missingAr.length;
}

// Keys in AR but missing in EN
const missingEn = [...arKeys].filter(k => !enKeys.has(k));
if (missingEn.length) {
  console.log(`\n❌ Keys in AR but missing in EN (${missingEn.length}):`);
  missingEn.forEach(k => console.log(`   - ${k}`));
  issues += missingEn.length;
}

// Keys used in code but missing from EN
const missingFromCode = [...usedKeys].filter(k => !enKeys.has(k));
if (missingFromCode.length) {
  console.log(`\n⚠️  Keys used in code but missing from EN (${missingFromCode.length}):`);
  missingFromCode.forEach(k => console.log(`   - ${k}`));
  issues += missingFromCode.length;
}

// Summary
console.log(`\n📊 i18n Coverage Summary:`);
console.log(`   EN keys: ${enKeys.size}`);
console.log(`   AR keys: ${arKeys.size}`);
console.log(`   Used in code: ${usedKeys.size}`);
console.log(`   Issues: ${issues}`);

if (issues === 0) {
  console.log('\n✅ All i18n keys are in sync.\n');
} else {
  console.log(`\n❌ ${issues} issue(s) found.\n`);
}

process.exit(issues > 0 ? 1 : 0);
