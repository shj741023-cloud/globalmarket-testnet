'use strict';

function closeHttpServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function createShutdownHandler({ server, store, timeoutMs = 10_000, logger = console }) {
  let stopping = false;
  return async function shutdown(signal = 'shutdown') {
    if (stopping) return { idempotent: true };
    stopping = true;
    logger.log(`GRACEFUL_SHUTDOWN_STARTED ${signal}`);
    const timeout = setTimeout(() => server.closeAllConnections?.(), timeoutMs);
    timeout.unref?.();
    try {
      await closeHttpServer(server);
      await store.close();
      logger.log('GRACEFUL_SHUTDOWN_COMPLETED');
      return { idempotent: false };
    } catch (error) {
      logger.error('GRACEFUL_SHUTDOWN_FAILED', error.message);
      process.exitCode = 1;
      return { idempotent: false, error };
    } finally {
      clearTimeout(timeout);
    }
  };
}

module.exports = { closeHttpServer, createShutdownHandler };
