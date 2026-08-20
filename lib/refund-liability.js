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
  const future = Number(quote.refundTransferGasFee || 0) + Number(quote.settlementTransferGasFee || 0);
  const total = original + future;
  const buyerGasLiability = roundPi(total * shares.buyer);
  const sellerGasLiability = roundPi(total * shares.seller);
  const platformGasLiability = roundPi(total * shares.platform);
  const buyerOriginalGasReimbursement = roundPi(original * (1 - shares.buyer));
  const buyerFutureGasCharge = roundPi(future * shares.buyer);
  const buyerFinalRefund = roundPi(Math.max(0, quote.totalBuyerRefundBeforeGasAllocation + buyerOriginalGasReimbursement - buyerFutureGasCharge));
  const sellerGrossSettlement = roundPi(Math.max(0, quote.retainedAmount - quote.sellerFinalFee));
  const sellerFinalSettlement = roundPi(Math.max(0, sellerGrossSettlement - sellerGasLiability));
  return {
    faultType, shares, buyerGasLiability, sellerGasLiability, platformGasLiability,
    buyerOriginalGasReimbursement, buyerFutureGasCharge, buyerFinalRefund,
    sellerGrossSettlement, sellerFinalSettlement,
    sellerOutstandingGas: roundPi(Math.max(0, sellerGasLiability - sellerGrossSettlement))
  };
}

module.exports = { calculateGasLiability };
