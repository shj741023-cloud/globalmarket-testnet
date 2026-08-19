'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');

function secureDatabaseUrl(databaseUrl) {
  if (!databaseUrl) return databaseUrl;
  const url = new URL(databaseUrl);
  if (url.searchParams.get('sslmode') === 'require') url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}

const initialState = () => ({
  meta: { network: 'testnet', asset: 'test-pi', isSimulation: true },
  users: [],
  sessions: [],
  products: [
    {
      id: 'product_demo_1',
      sellerId: 'seller_demo',
      title: 'Testnet 중고 카메라',
      description: '기능시험용 가상 상품입니다. 실제 판매상품이 아닙니다.',
      price: 25,
      categoryId: 'digital_devices',
      status: 'available',
      methods: ['direct', 'parcel_testnet'],
      region: '서울'
    }
  ],
  chatRooms: [],
  messages: [],
  priceProposals: [],
  agreements: [],
  trades: [],
  directTradeRecords: [],
  payments: [],
  shipments: [],
  settlements: [],
  refunds: [],
  disputes: [],
  reports: [],
  notifications: [],
  auditLogs: [],
  reviews: [],
  trustProfiles: [],
  trustEvents: [],
  favorites: [],
  events: []
});

class Store {
  constructor(filePath, databaseUrl = process.env.DATABASE_URL) {
    this.filePath = filePath;
    this.databaseUrl = secureDatabaseUrl(databaseUrl);
    this.backend = databaseUrl ? 'postgres-pending' : 'file';
    this.pool = null;
    this.writeQueue = Promise.resolve();
    this.state = initialState();
    if (!this.databaseUrl) this.loadFile();
  }

  normalizeState(parsed) {
    if (parsed?.meta?.network !== 'testnet' || parsed?.meta?.isSimulation !== true) {
      throw new Error('Refusing to load non-Testnet data');
    }
    this.state = parsed;
    this.state.users ||= [];
    this.state.sessions ||= [];
    this.state.products ||= [];
    for (const product of this.state.products) {
      product.categoryId ||= 'other_physical';
      product.images ||= product.imageData ? [product.imageData] : [];
      delete product.imageData;
    }
    this.state.chatRooms ||= [];
    this.state.messages ||= [];
    this.state.priceProposals ||= [];
    this.state.agreements ||= [];
    this.state.trades ||= [];
    this.state.directTradeRecords ||= [];
    this.state.payments ||= [];
    this.state.shipments ||= [];
    this.state.settlements ||= [];
    this.state.refunds ||= [];
    this.state.disputes ||= [];
    this.state.reports ||= [];
    this.state.notifications ||= [];
    this.state.auditLogs ||= [];
    this.state.reviews ||= [];
    this.state.trustProfiles ||= [];
    this.state.trustEvents ||= [];
    this.state.favorites ||= [];
    this.state.events ||= [];
  }

  loadFile() {
    if (!fs.existsSync(this.filePath)) return;
    const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    this.normalizeState(parsed);
  }

  async initialize() {
    if (!this.databaseUrl) return { backend: this.backend };
    this.pool = new Pool({ connectionString: this.databaseUrl, max: 1 });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS global_market_testnet_state (
        id TEXT PRIMARY KEY,
        state JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const result = await this.pool.query('SELECT state FROM global_market_testnet_state WHERE id = $1', ['primary']);
    if (result.rows[0]) {
      this.normalizeState(result.rows[0].state);
    } else {
      await this.pool.query(
        'INSERT INTO global_market_testnet_state (id, state) VALUES ($1, $2::jsonb)',
        ['primary', JSON.stringify(this.state)]
      );
    }
    this.backend = 'postgres';
    return { backend: this.backend };
  }

  save() {
    if (this.pool) {
      const snapshot = JSON.stringify(this.state);
      this.writeQueue = this.writeQueue
        .catch(() => undefined)
        .then(() => this.pool.query(
          `INSERT INTO global_market_testnet_state (id, state, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
          ['primary', snapshot]
        ));
      return this.writeQueue;
    }
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(temporary, this.filePath);
    return Promise.resolve();
  }

  async close() {
    await this.writeQueue;
    if (this.pool) await this.pool.end();
  }

  async readiness() {
    if (this.pool) await this.pool.query('SELECT 1');
    return { ok: true, backend: this.backend };
  }

  id(prefix) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  event(type, relatedId, data = {}) {
    const event = {
      id: this.id('event'),
      type,
      relatedId,
      data,
      createdAt: new Date().toISOString()
    };
    this.state.events.push(event);
    return event;
  }

  findProduct(id) {
    return this.state.products.find((item) => item.id === id);
  }

  findTrade(id) {
    return this.state.trades.find((item) => item.id === id);
  }

  findPayment(id) {
    return this.state.payments.find((item) => item.id === id);
  }

  findShipmentByTrade(tradeId) {
    return this.state.shipments.find((item) => item.tradeId === tradeId);
  }
}

module.exports = { Store, initialState, secureDatabaseUrl };
