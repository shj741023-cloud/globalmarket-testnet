'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'data']);
const inspectedExtensions = new Set(['.js', '.json', '.md', '.yaml', '.yml', '.html', '.css']);

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return ignoredDirectories.has(entry.name) ? [] : sourceFiles(path.join(directory, entry.name));
    return inspectedExtensions.has(path.extname(entry.name)) ? [path.join(directory, entry.name)] : [];
  });
}

test('배포 소스에 실제 비밀키·토큰·고정 지갑주소를 포함하지 않는다', () => {
  const findings = [];
  const patterns = [
    ['OpenAI 형식 키', /sk-[A-Za-z0-9_-]{20,}/g],
    ['Bearer 토큰 원문', /Bearer\s+[A-Za-z0-9._-]{20,}/g],
    ['Stellar 비밀 시드', /S[A-Z2-7]{55}/g],
    ['고정 Pi 지갑주소', /G[A-Z2-7]{55}/g]
  ];
  for (const file of sourceFiles(root)) {
    const content = fs.readFileSync(file, 'utf8');
    for (const [label, pattern] of patterns) if (pattern.test(content)) findings.push(`${label}: ${path.relative(root, file)}`);
  }
  assert.deepEqual(findings, []);
});

test('비밀 환경파일과 로컬 데이터는 Git 추적 대상에서 제외한다', () => {
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^data\/\*\.json$/m);
});
