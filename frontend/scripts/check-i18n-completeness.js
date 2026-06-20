#!/usr/bin/env node
// Fails if any language file is missing keys that exist in en.json.
// Plural-aware: for i18next plural groups (_one/_other etc.) a language only
// needs at least one suffix variant, not every one English defines.
// Run: node frontend/scripts/check-i18n-completeness.js

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const en = require(join(__dirname, '../src/i18n/en.json'));
const languages = ['ar', 'zh', 'fr', 'ru', 'es', 'tr'];

const PLURAL_SUFFIXES = /_(zero|one|two|few|many|other)$/;

function getKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null ? getKeys(v, key) : [key];
  });
}

// Derive required base keys from en.json. For plural groups, record the base
// once; for plain keys, the key itself is required.
function requiredBases(keys) {
  const bases = new Set();
  for (const key of keys) {
    bases.add(key.replace(PLURAL_SUFFIXES, ''));
  }
  return bases;
}

const enKeys = getKeys(en);
const enBases = requiredBases(enKeys);
let failed = false;

for (const lang of languages) {
  const translation = require(join(__dirname, `../src/i18n/${lang}.json`));
  const trKeys = getKeys(translation);
  // For each key in the target, record both the key itself and its base.
  const trPresent = new Set(trKeys.flatMap(k => [k, k.replace(PLURAL_SUFFIXES, '')]));
  const missing = [...enBases].filter(base => !trPresent.has(base));
  if (missing.length) {
    console.error(`❌ ${lang}: missing ${missing.length} key(s):\n  ${missing.join('\n  ')}`);
    failed = true;
  }
}

if (failed) {
  console.error('\nAdd the missing keys to each language file to fix this check.');
  process.exit(1);
}

console.log(`✅ All ${languages.length} language files complete (${enBases.size} base keys checked).`);
