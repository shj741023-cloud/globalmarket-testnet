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
  // 확정된 Testnet 정책: 과실 판정은 상품대금에만 반영하고,
  // 환불·정산을 받는 각 당사자가 자신의 송금 가스비를 부담한다.
  const buyerGasLiability = roundPi(original + refundGas);
  const sellerGasLiability = roundPi(settlementGas);
  const platformGasLiability = 0;
  const buyerOriginalGasReimbursement = 0;
  const buyerFutureGasCharge = roundPi(refundGas);
  const buyerBaseRefund = roundPi(Math.max(0, quote.totalBuyerRefundBeforeGasAllocation - buyerFutureGasCharge));
  // A gas reimbursement is only a claim until the liable party's funds are
  // actually recovered. Do not make the buyer's payable refund look larger
  // by counting an uncollected reimbursement as money already available.
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
