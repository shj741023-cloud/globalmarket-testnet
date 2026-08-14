'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

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
  events: []
});

class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = initialState();
    this.load();
  }

  load() {
    if (!fs.existsSync(this.filePath)) return;
    const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    if (parsed?.meta?.network !== 'testnet' || parsed?.meta?.isSimulation !== true) {
      throw new Error('Refusing to load non-Testnet data');
    }
    this.state = parsed;
    this.state.users ||= [];
    this.state.sessions ||= [];
    this.state.products ||= [];
    for (const product of this.state.products) product.categoryId ||= 'other_physical';
    this.state.chatRooms ||= [];
    this.state.messages ||= [];
    this.state.priceProposals ||= [];
    this.state.agreements ||= [];
    this.state.directTradeRecords ||= [];
    this.state.shipments ||= [];
    this.state.refunds ||= [];
    this.state.disputes ||= [];
    this.state.reports ||= [];
    this.state.notifications ||= [];
    this.state.auditLogs ||= [];
    this.state.reviews ||= [];
    this.state.trustProfiles ||= [];
    this.state.trustEvents ||= [];
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(temporary, this.filePath);
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

module.exports = { Store, initialState };
