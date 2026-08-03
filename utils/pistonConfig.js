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
const PISTON_MAX_COMPILE_TIMEOUT_MS = Number(process.env.PISTON_MAX_COMPILE_TIMEOUT_MS || 3000);
const PISTON_MAX_RUN_TIMEOUT_MS = Number(process.env.PISTON_MAX_RUN_TIMEOUT_MS || 3000);

/** Cap compile/run timeouts to what the Piston server allows (default 3000ms). */
const resolvePistonTimeouts = (options = {}) => {
  const compile = Number(options.compile_timeout ?? PISTON_MAX_COMPILE_TIMEOUT_MS);
  const run = Number(options.run_timeout ?? PISTON_MAX_RUN_TIMEOUT_MS);
  return {
    compile_timeout: Math.min(
      Number.isFinite(compile) && compile > 0 ? compile : PISTON_MAX_COMPILE_TIMEOUT_MS,
      PISTON_MAX_COMPILE_TIMEOUT_MS
    ),
    run_timeout: Math.min(
      Number.isFinite(run) && run > 0 ? run : PISTON_MAX_RUN_TIMEOUT_MS,
      PISTON_MAX_RUN_TIMEOUT_MS
    )
  };
};

module.exports = {
  getPistonBaseUrl,
  getPistonExecuteUrl,
  getPistonRuntimesUrl,
  isPistonConfigured,
  PISTON_FETCH_TIMEOUT_MS,
  PISTON_MAX_COMPILE_TIMEOUT_MS,
  PISTON_MAX_RUN_TIMEOUT_MS,
  resolvePistonTimeouts
};
