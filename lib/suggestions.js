'use strict';

const CATEGORIES = ['general', 'suggestion', 'payment', 'trade', 'report_dispute'];

function createSuggestion({ id, userId, category = 'suggestion', title, content, now = new Date().toISOString() }) {
  const selectedCategory = String(category || 'suggestion');
  if (!CATEGORIES.includes(selectedCategory)) {
    const error = new Error('올바른 문의 유형을 선택하세요.');
    error.code = 'INVALID_SUGGESTION_CATEGORY';
    throw error;
  }
  const heading = String(title || '').trim();
  if (heading.length < 2 || heading.length > 60) {
    const error = new Error('제목은 2자 이상 60자 이하로 입력하세요.');
    error.code = 'INVALID_SUGGESTION_TITLE';
    throw error;
  }
  const text = String(content || '').trim();
  if (text.length < 5 || text.length > 500) {
    const error = new Error('건의사항은 5자 이상 500자 이하로 입력하세요.');
    error.code = 'INVALID_SUGGESTION';
    throw error;
  }
  return { id, userId, category: selectedCategory, title: heading, content: text, status: 'received', createdAt: now, updatedAt: now };
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

module.exports = { CATEGORIES, createSuggestion, closeSuggestion };
