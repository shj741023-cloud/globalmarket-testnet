'use strict';

const SHARES = {
  seller_fault: { buyer: 0, seller: 1, platform: 0 },
  buyer_fault: { buyer: 1, seller: 0, platform: 0 },
  shared_fault: { buyer: 0.5, seller: 0.5, platform: 0 },
  platform_fault: { buyer: 0, seller: 0, platform: 1 }
};

function roundPi(value) { return Math.round((Number(value) + Number.EPSILON) * 10000000) / 10000000; }

function calculateGasLiability(quote, faultType) {
  const shares = SHARES[faultType];
  if (!shares) throw Object.assign(new Error('A supported fault decision is required'), { code: 'FAULT_DECISION_REQUIRED' });
  const original = Number(quote.originalPaymentGasFee || 0);
  const refundGas = Number(quote.refundTransferGasFee || 0);
  const settlementGas = Number(quote.settlementTransferGasFee || 0);
  // Testnet simple policy: fault affects the merchandise decision only.
  // Each recipient bears the network fee for their own outgoing transfer and
  // neither party can claim gas reimbursement from the other.
  const buyerGasLiability = roundPi(original + refundGas);
  const sellerGasLiability = roundPi(settlementGas);
  const platformGasLiability = 0;
  const buyerOriginalGasReimbursement = 0;
  const buyerFutureGasCharge = roundPi(refundGas);
  const buyerBaseRefund = roundPi(Math.max(0, quote.totalBuyerRefundBeforeGasAllocation - buyerFutureGasCharge));
  const buyerGasCompensationClaim = 0;
  const buyerGasCompensationPaid = 0;
  const buyerFinalRefund = buyerBaseRefund;
  const buyerPotentialTotalAfterGasCompensation = buyerBaseRefund;
  const sellerGrossSettlement = roundPi(Math.max(0, quote.retainedAmount - quote.sellerFinalFee));
  const sellerFinalSettlement = roundPi(Math.max(0, sellerGrossSettlement - sellerGasLiability));
  return {
    faultType, shares, buyerGasLiability, sellerGasLiability, platformGasLiability,
    buyerOriginalGasReimbursement, buyerFutureGasCharge, buyerBaseRefund,
    buyerGasCompensationClaim, buyerGasCompensationPaid,
    gasCompensationStatus: 'waived_by_policy', gasPolicy: 'each_party_bears_own_fee',
    buyerFinalRefund, buyerPotentialTotalAfterGasCompensation,
    sellerGrossSettlement, sellerFinalSettlement,
    sellerOutstandingGas: 0
  };
}

module.exports = { calculateGasLiability };
