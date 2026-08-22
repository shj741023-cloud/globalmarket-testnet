'use strict';

function createSuggestion({ id, userId, content, now = new Date().toISOString() }) {
  const text = String(content || '').trim();
  if (text.length < 5 || text.length > 500) {
    const error = new Error('건의사항은 5자 이상 500자 이하로 입력하세요.');
    error.code = 'INVALID_SUGGESTION';
    throw error;
  }
  return { id, userId, content: text, status: 'received', createdAt: now, updatedAt: now };
}

function closeSuggestion(suggestion, reason, now = new Date().toISOString()) {
  const text = String(reason || '').trim();
  if (!text) {
    const error = new Error('처리 내용을 입력하세요.');
    error.code = 'INVALID_SUGGESTION_DECISION';
    throw error;
  }
  if (suggestion.status === 'closed') return { idempotent: true, suggestion };
  suggestion.status = 'closed';
  suggestion.decision = { reason: text, decidedAt: now };
  suggestion.updatedAt = now;
  return { idempotent: false, suggestion };
}

module.exports = { createSuggestion, closeSuggestion };
