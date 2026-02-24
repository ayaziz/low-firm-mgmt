#!/usr/bin/env npx ts-node
/**
 * i18n Translation Audit Script
 * ------------------------------------------------------------------
 * Scans all frontend source files for `t('key')` calls and compares
 * them against the keys present in en.json and ar.json.
 *
 * Reports:
 *   1. Keys used in code but MISSING from en.json
 *   2. Keys used in code but MISSING from ar.json
 *   3. Keys present in en.json but NOT used in code (unused)
 *   4. Keys present in en.json but MISSING from ar.json (parity)
 *   5. Keys present in ar.json but MISSING from en.json (parity)
 *
 * Usage:
 *   npx ts-node scripts/i18n-audit.ts
 *   # or
 *   node -e "require('./scripts/i18n-audit.ts')"
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Paths ──────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const FRONTEND_SRC = path.join(ROOT, 'frontend', 'src');
const EN_JSON = path.join(FRONTEND_SRC, 'i18n', 'locales', 'en.json');
const AR_JSON = path.join(FRONTEND_SRC, 'i18n', 'locales', 'ar.json');

// ── Helpers ────────────────────────────────────────────────────────
/** Recursively list all files under `dir` matching `extensions`. */
function walk(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // skip node_modules / .next
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      results.push(...walk(full, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

/** Flatten a nested JSON object into dot-separated leaf keys. */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

/** Extract all t('...') and t("...") keys from source code. */
function extractKeysFromSource(files: string[]): Set<string> {
  const keys = new Set<string>();
  // Matches: t('key'), t("key"), t(`key`)
  const regex = /\bt\(\s*['"`]([^'"`\n]+)['"`]/g;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const key = match[1];
      // Skip interpolated template literals
      if (key.includes('${')) continue;
      keys.add(key);
    }
  }
  return keys;
}

// ── Main ───────────────────────────────────────────────────────────
function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║        i18n Translation Audit            ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // 1. Load locale files
  if (!fs.existsSync(EN_JSON)) {
    console.error(`❌ en.json not found at ${EN_JSON}`);
    process.exit(1);
  }
  if (!fs.existsSync(AR_JSON)) {
    console.error(`❌ ar.json not found at ${AR_JSON}`);
    process.exit(1);
  }

  const enData = JSON.parse(fs.readFileSync(EN_JSON, 'utf-8'));
  const arData = JSON.parse(fs.readFileSync(AR_JSON, 'utf-8'));
  const enKeys = new Set(flattenKeys(enData));
  const arKeys = new Set(flattenKeys(arData));

  // 2. Scan source files
  const sourceFiles = walk(FRONTEND_SRC, ['.tsx', '.ts', '.jsx', '.js']);
  const usedKeys = extractKeysFromSource(sourceFiles);

  // 3. Compute differences
  const missingInEn = [...usedKeys].filter((k) => !enKeys.has(k)).sort();
  const missingInAr = [...usedKeys].filter((k) => !arKeys.has(k)).sort();
  const unusedInEn = [...enKeys].filter((k) => !usedKeys.has(k)).sort();
  const enNotInAr = [...enKeys].filter((k) => !arKeys.has(k)).sort();
  const arNotInEn = [...arKeys].filter((k) => !enKeys.has(k)).sort();

  // 4. Report
  const section = (title: string, items: string[]) => {
    const icon = items.length === 0 ? '✅' : '⚠️';
    console.log(`${icon} ${title}: ${items.length}`);
    if (items.length > 0) {
      items.forEach((k) => console.log(`   - ${k}`));
    }
    console.log();
  };

  console.log(`📊 Source files scanned : ${sourceFiles.length}`);
  console.log(`🔑 Unique t() keys used: ${usedKeys.size}`);
  console.log(`🇬🇧 en.json leaf keys    : ${enKeys.size}`);
  console.log(`🇸🇦 ar.json leaf keys    : ${arKeys.size}`);
  console.log();

  section('Keys used in code but MISSING from en.json', missingInEn);
  section('Keys used in code but MISSING from ar.json', missingInAr);
  section('Keys in en.json but NOT used in code (potentially unused)', unusedInEn);
  section('Keys in en.json but MISSING from ar.json (parity gap)', enNotInAr);
  section('Keys in ar.json but MISSING from en.json (parity gap)', arNotInEn);

  // 5. Exit code
  const hasErrors = missingInEn.length > 0 || missingInAr.length > 0 || enNotInAr.length > 0 || arNotInEn.length > 0;
  if (hasErrors) {
    console.log('❌ Audit FAILED — translation gaps detected.');
    process.exit(1);
  } else {
    console.log('✅ Audit PASSED — all used keys are present in both locales and parity is maintained.');
    process.exit(0);
  }
}

main();
