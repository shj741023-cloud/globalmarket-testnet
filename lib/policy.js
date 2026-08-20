'use strict';

const NETWORK = 'testnet';
const ASSET = 'test-pi';
const BUYER_FEE_RATE = 0.01;
const SELLER_FEE_RATE = 0.01;
const PI_GAS_FEE = 0.01;

function asAmount(value, field = 'amount') {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    const error = new Error(`${field} must be a positive number`);
    error.code = 'INVALID_AMOUNT';
    throw error;
  }
  return Math.round(number * 10000000) / 10000000;
}

function roundPi(value) {
  return Math.round((value + Number.EPSILON) * 10000000) / 10000000;
}

function paymentQuote(productAmount, networkFee = 0) {
  const amount = asAmount(productAmount, 'productAmount');
  const fee = Number(networkFee);
  if (!Number.isFinite(fee) || fee < 0) {
    const error = new Error('networkFee must be zero or positive');
    error.code = 'INVALID_NETWORK_FEE';
    throw error;
  }
  const buyerFee = roundPi(amount * BUYER_FEE_RATE);
  const sellerFee = roundPi(amount * SELLER_FEE_RATE);
  return {
    network: NETWORK,
    asset: ASSET,
    isSimulation: true,
    productAmount: amount,
    buyerFee,
    sellerFee,
    networkFee: roundPi(fee),
    buyerTotal: roundPi(amount + buyerFee + fee),
    sellerExpectedSettlement: roundPi(amount - sellerFee)
  };
}

function assertTestnetEnvironment(env = process.env) {
  const network = String(env.APP_NETWORK || NETWORK).toLowerCase();
  const sandbox = String(env.PI_SANDBOX ?? 'true').toLowerCase();
  if (network !== NETWORK || sandbox !== 'true') {
    const error = new Error('Mainnet is disabled. APP_NETWORK=testnet and PI_SANDBOX=true are required.');
    error.code = 'MAINNET_DISABLED';
    throw error;
  }
}

function assertFinancialTradeAllowed(trade) {
  if (!trade || trade.type !== 'parcel_testnet') {
    const error = new Error('Financial operations are not available for direct trades.');
    error.code = 'DIRECT_TRADE_FINANCE_BLOCKED';
    throw error;
  }
}

module.exports = {
  ASSET,
  NETWORK,
  BUYER_FEE_RATE,
  SELLER_FEE_RATE,
  PI_GAS_FEE,
  paymentQuote,
  assertTestnetEnvironment,
  assertFinancialTradeAllowed
};
