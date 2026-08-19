'use strict';

const crypto = require('node:crypto');

function createRequestId() {
  return `req_${crypto.randomUUID()}`;
}

function isRequestId(value) {
  return /^req_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

module.exports = { createRequestId, isRequestId };
