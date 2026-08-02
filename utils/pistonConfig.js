/**
 * Piston code execution server configuration.
 */

const getPistonBaseUrl = () => {
  const rawUrl = (process.env.PISTON_URL || 'http://localhost').trim().replace(/\/+$/, '');
  const port = String(process.env.PISTON_PORT || '2000').trim();

  if (/^https?:\/\//i.test(rawUrl)) {
    try {
      const parsed = new URL(rawUrl);
      if (!parsed.port && port) {
        parsed.port = port;
      }
      return parsed.origin;
    } catch {
      return `${rawUrl}:${port}`;
    }
  }

  return `http://${rawUrl}:${port}`;
};

const getPistonExecuteUrl = () => `${getPistonBaseUrl()}/api/v2/execute`;
const getPistonRuntimesUrl = () => `${getPistonBaseUrl()}/api/v2/runtimes`;

const isPistonConfigured = () => {
  const rawUrl = (process.env.PISTON_URL || '').trim();
  if (!rawUrl) return false;
  return !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(rawUrl);
};

const PISTON_FETCH_TIMEOUT_MS = Number(process.env.PISTON_TIMEOUT_MS || 20000);

module.exports = {
  getPistonBaseUrl,
  getPistonExecuteUrl,
  getPistonRuntimesUrl,
  isPistonConfigured,
  PISTON_FETCH_TIMEOUT_MS
};
