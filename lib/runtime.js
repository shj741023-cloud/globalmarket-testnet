'use strict';

function deploymentRevision(env = process.env) {
  const commit = String(env.RENDER_GIT_COMMIT || '').trim();
  return /^[a-f0-9]{7,40}$/i.test(commit) ? commit.slice(0, 7).toLowerCase() : 'local';
}

module.exports = { deploymentRevision };
