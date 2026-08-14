'use strict';

function positivePrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) throw Object.assign(new Error('Price must be positive'), { code: 'INVALID_PRICE' });
  return Math.round(price * 10000000) / 10000000;
}

function assertParty(room, userId) {
  if (!room || ![room.sellerId, room.buyerId].includes(userId)) {
    throw Object.assign(new Error('Only chat parties can perform this action'), { code: 'CHAT_PARTY_REQUIRED' });
  }
}

function createProposal(room, input, now = new Date()) {
  assertParty(room, input.proposerId);
  return {
    id: input.id, roomId: room.id, proposerId: input.proposerId,
    recipientId: input.proposerId === room.sellerId ? room.buyerId : room.sellerId,
    price: positivePrice(input.price), status: 'pending',
    createdAt: now.toISOString(), respondedAt: null
  };
}

function respondProposal(proposal, userId, action, now = new Date()) {
  if (!proposal || proposal.recipientId !== userId) throw Object.assign(new Error('Only the recipient can respond'), { code: 'PROPOSAL_RECIPIENT_REQUIRED' });
  if (proposal.status !== 'pending') return { proposal, idempotent: true };
  if (!['accepted', 'rejected'].includes(action)) throw Object.assign(new Error('Use accepted or rejected'), { code: 'INVALID_PROPOSAL_ACTION' });
  proposal.status = action;
  proposal.respondedAt = now.toISOString();
  return { proposal, idempotent: false };
}

function createOrUpdateAgreement(existing, room, product, input, now = new Date()) {
  assertParty(room, input.actorId);
  if (!['direct', 'parcel_testnet'].includes(input.type) || !product.methods.includes(input.type)) {
    throw Object.assign(new Error('Trade type is not supported by this product'), { code: 'INVALID_AGREEMENT_TYPE' });
  }
  const price = positivePrice(input.price);
  if (!existing) {
    return {
      id: input.id, roomId: room.id, productId: product.id,
      sellerId: room.sellerId, buyerId: room.buyerId,
      price, type: input.type, status: 'pending_confirmation',
      sellerConfirmedAt: null, buyerConfirmedAt: null,
      version: 1, createdAt: now.toISOString(), updatedAt: now.toISOString()
    };
  }
  const changed = existing.price !== price || existing.type !== input.type;
  existing.price = price;
  existing.type = input.type;
  existing.updatedAt = now.toISOString();
  if (changed) {
    existing.version += 1;
    existing.status = 'pending_confirmation';
    existing.sellerConfirmedAt = null;
    existing.buyerConfirmedAt = null;
  }
  return existing;
}

function confirmAgreement(agreement, userId, now = new Date()) {
  if (![agreement.sellerId, agreement.buyerId].includes(userId)) throw Object.assign(new Error('Agreement party required'), { code: 'AGREEMENT_PARTY_REQUIRED' });
  const field = userId === agreement.sellerId ? 'sellerConfirmedAt' : 'buyerConfirmedAt';
  const idempotent = Boolean(agreement[field]);
  agreement[field] ||= now.toISOString();
  agreement.status = agreement.sellerConfirmedAt && agreement.buyerConfirmedAt ? 'confirmed' : 'pending_confirmation';
  return { agreement, idempotent };
}

function tradeFromAgreement(agreement, existingTrade, input, now = new Date()) {
  if (existingTrade) return { trade: existingTrade, idempotent: true };
  if (!agreement || agreement.status !== 'confirmed' || !agreement.sellerConfirmedAt || !agreement.buyerConfirmedAt) {
    throw Object.assign(new Error('Both parties must confirm the agreement'), { code: 'AGREEMENT_NOT_CONFIRMED' });
  }
  return {
    trade: {
      id: input.id, agreementId: agreement.id, productId: agreement.productId,
      sellerId: agreement.sellerId, buyerId: agreement.buyerId,
      type: agreement.type, amount: agreement.price,
      status: agreement.type === 'direct' ? 'meeting_agreed' : 'payment_pending',
      settlementHold: false, createdAt: now.toISOString()
    },
    idempotent: false
  };
}

module.exports = { positivePrice, assertParty, createProposal, respondProposal, createOrUpdateAgreement, confirmAgreement, tradeFromAgreement };
