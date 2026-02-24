const fs = require('fs');
const path = require('path');

function walk(dir, filter = () => true, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, files);
    else if (filter(full)) files.push(full);
  }
  return files;
}

function normalizeFrontPath(raw) {
  const normalized = raw
    .replace(/\$\{[^}]+\}/g, ':param')
    .replace(/\?.*$/, '')
    .replace(/\/+/g, '/')
    .trim();
  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function normalizeBackPath(base, methodPath) {
  const b = base ? `/${base}` : '';
  const m = methodPath ? `/${methodPath}` : '';
  return `${b}${m}`.replace(/\/+/g, '/');
}

function toMatcher(route) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = '^' + escaped.replace(/:([A-Za-z0-9_]+)/g, '[^/]+') + '$';
  return new RegExp(pattern);
}

const repoRoot = process.cwd();
const frontendApiDir = path.join(repoRoot, 'frontend', 'src', 'api');
const backendDir = path.join(repoRoot, 'backend', 'src');

const frontendFiles = walk(frontendApiDir, (f) => f.endsWith('.ts') || f.endsWith('.tsx'));
const backendControllerFiles = walk(backendDir, (f) => f.endsWith('.controller.ts'));

const frontRoutes = new Set();
const frontRegex = /(?:get|post|patch|put|del|downloadBlob)\s*(?:<[^>]+>)?\(\s*(?:`([^`]+)`|'([^']+)'|"([^"]+)")/g;

for (const file of frontendFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = frontRegex.exec(content)) !== null) {
    const raw = match[1] || match[2] || match[3] || '';
    if (!raw.startsWith('/')) continue;
    frontRoutes.add(normalizeFrontPath(raw));
  }
}

const backRoutes = [];
for (const file of backendControllerFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const controllerMatch = content.match(/@Controller\((?:'([^']*)'|"([^"]*)")\)/);
  const controllerBase = (controllerMatch && (controllerMatch[1] || controllerMatch[2])) || '';

  const methodRegex = /@(Get|Post|Patch|Delete)\((?:'([^']*)'|"([^"]*)")?\)/g;
  let m;
  while ((m = methodRegex.exec(content)) !== null) {
    const methodPath = m[2] || m[3] || '';
    backRoutes.push(normalizeBackPath(controllerBase, methodPath));
  }
}

const backendMatchers = backRoutes.map(toMatcher);

const ignore = new Set([
  '/api/v1/telemetry/ui-error',
  '/api/v1/reports/:param',
  '/api/v1/reports/:param/export:param',
  '/api/v1/wages/export:param',
]);

const missing = [];
for (const fr of Array.from(frontRoutes).sort()) {
  const full = `/api/v1${fr}`;
  if (ignore.has(full)) continue;
  const apiPath = fr;
  const matched = backendMatchers.some((rx) => rx.test(apiPath));
  if (!matched) {
    missing.push({ frontend: full });
  }
}

console.log('Frontend API routes:', frontRoutes.size);
console.log('Backend controller routes:', backRoutes.length);

if (missing.length > 0) {
  console.log('\nMissing backend routes for frontend calls:');
  for (const row of missing) {
    console.log(`- ${row.frontend}`);
  }
  process.exit(1);
}

console.log('\nRoute contract check passed: no missing frontend API routes.');
