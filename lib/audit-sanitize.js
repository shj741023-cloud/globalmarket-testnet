'use strict';

const OMIT_KEYS = new Set(['piuid', 'sessions', 'images', 'imagedata', 'authorization']);

function isSensitiveKey(key) {
  const normalized = String(key).replace(/[_-]/g, '').toLowerCase();
  return OMIT_KEYS.has(normalized) || /(token|password|secret|apikey|adminkey)$/.test(normalized);
}

function sanitizeAuditSnapshot(value) {
  if (value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.map(sanitizeAuditSnapshot);
  if (typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !isSensitiveKey(key))
    .map(([key, nested]) => [key, sanitizeAuditSnapshot(nested)]));
}

function sanitizeAuditEntry(entry) {
  return { ...entry, before: sanitizeAuditSnapshot(entry.before), after: sanitizeAuditSnapshot(entry.after) };
}

module.exports = { isSensitiveKey, sanitizeAuditSnapshot, sanitizeAuditEntry };
