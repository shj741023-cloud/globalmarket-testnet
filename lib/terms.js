'use strict';

const CURRENT_TERMS = Object.freeze([
  { id: 'terms_of_service', title: '이용약관', version: '2026-08-20', required: true, url: '/terms.html' },
  { id: 'privacy_policy', title: '개인정보처리방침', version: '2026-08-16', required: true, url: '/privacy.html' }
]);

function currentTerms() {
  return CURRENT_TERMS.map((term) => ({ ...term }));
}

function recordRequiredConsents(consents, userId, submitted, now = new Date()) {
  if (!userId) throw Object.assign(new Error('User is required'), { code: 'USER_REQUIRED' });
  const accepted = new Map((Array.isArray(submitted) ? submitted : []).filter((item) => item?.accepted === true).map((item) => [`${item.id}:${item.version}`, item]));
  const missing = CURRENT_TERMS.filter((term) => term.required && !accepted.has(`${term.id}:${term.version}`));
  if (missing.length) throw Object.assign(new Error('All current required terms must be accepted individually'), { code: 'REQUIRED_TERMS_NOT_ACCEPTED', missing: missing.map((term) => term.id) });
  const created = [];
  for (const term of CURRENT_TERMS) {
    if (!accepted.has(`${term.id}:${term.version}`)) continue;
    const duplicate = consents.find((item) => item.userId === userId && item.termId === term.id && item.version === term.version);
    if (duplicate) continue;
    const record = { userId, termId: term.id, version: term.version, acceptedAt: now.toISOString() };
    consents.push(record); created.push(record);
  }
  return { items: consents.filter((item) => item.userId === userId), created, idempotent: created.length === 0 };
}

function hasCurrentRequiredConsents(consents, userId) {
  return CURRENT_TERMS.filter((term) => term.required).every((term) => consents.some((item) => item.userId === userId && item.termId === term.id && item.version === term.version));
}

module.exports = { CURRENT_TERMS, currentTerms, recordRequiredConsents, hasCurrentRequiredConsents };
