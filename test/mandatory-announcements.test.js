'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

test('필수 공지는 일반 전체읽음 처리에서 제외된다', () => {
  assert.match(server, /item\.status === 'active' && !item\.mandatory && !readIds\.has\(item\.id\)/);
});

test('필수 공지는 사용자별 전용 확인 API로 저장된다', () => {
  assert.match(server, /announcements.*acknowledge/);
  assert.match(server, /announcementId: announcement\.id, userId, readAt: new Date\(\)\.toISOString\(\), acknowledged: true/);
});

test('첫 화면 필수 공지 차단창과 명시적 확인 버튼이 있다', () => {
  assert.match(html, /id="mandatoryAnnouncementGate"/);
  assert.match(html, /id="acknowledgeMandatoryAnnouncement"/);
  assert.match(app, /item\.mandatory && !item\.read/);
  assert.match(app, /renderMandatoryAnnouncementGate\(\)/);
});
