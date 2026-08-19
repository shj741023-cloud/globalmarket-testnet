'use strict';

function paginate(items, input = {}) {
  const requestedLimit = Number.parseInt(input.limit, 10);
  const requestedOffset = Number.parseInt(input.offset, 10);
  const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(50, requestedLimit)) : 20;
  const offset = Number.isInteger(requestedOffset) ? Math.max(0, requestedOffset) : 0;
  const page = items.slice(offset, offset + limit);
  return { items: page, total: items.length, limit, offset, hasMore: offset + page.length < items.length };
}

module.exports = { paginate };
