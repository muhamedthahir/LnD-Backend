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

const LANGUAGE_ALIASES = {
  python: ['python', 'python3', 'py'],
  python3: ['python', 'python3', 'py'],
  javascript: ['javascript', 'js', 'node'],
  js: ['javascript', 'js', 'node'],
  node: ['javascript', 'js', 'node'],
  java: ['java'],
  c: ['c'],
  cpp: ['cpp', 'c++'],
  'c++': ['cpp', 'c++'],
  csharp: ['csharp', 'c#', 'mono'],
  'c#': ['csharp', 'c#', 'mono'],
  typescript: ['typescript', 'ts']
};

let runtimeCache = null;
let runtimeCacheAt = 0;

async function getPistonRuntimes() {
  const now = Date.now();
  if (runtimeCache && now - runtimeCacheAt < 5 * 60 * 1000) {
    return runtimeCache;
  }
  const response = await fetch(getPistonRuntimesUrl(), {
    signal: AbortSignal.timeout(Math.min(PISTON_FETCH_TIMEOUT_MS, 5000))
  });
  if (!response.ok) {
    throw new Error(`Piston runtimes HTTP ${response.status}`);
  }
  runtimeCache = await response.json();
  runtimeCacheAt = now;
  return runtimeCache;
}

/**
 * Map editor language names to a runtime that actually exists on the Piston server.
 */
async function resolvePistonRuntime(requestedLanguage, requestedVersion) {
  const want = String(requestedLanguage || 'python').toLowerCase().trim();
  const candidates = LANGUAGE_ALIASES[want] || [want];

  try {
    const runtimes = await getPistonRuntimes();
    const matches = (Array.isArray(runtimes) ? runtimes : []).filter((runtime) => {
      const lang = String(runtime.language || '').toLowerCase();
      const aliases = (runtime.aliases || []).map((alias) => String(alias).toLowerCase());
      return candidates.includes(lang) || aliases.some((alias) => candidates.includes(alias));
    });

    if (matches.length > 0) {
      const requested = String(requestedVersion || '').trim();
      const versionMatch = requested
        ? matches.find((runtime) => String(runtime.version) === requested)
        : null;
      const chosen = versionMatch || matches[0];
      return { language: chosen.language, version: chosen.version };
    }
  } catch (error) {
    console.warn('Could not resolve Piston runtime from /runtimes:', error.message);
  }

  return {
    language: candidates[0],
    version: requestedVersion || '*'
  };
}

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
  resolvePistonTimeouts,
  resolvePistonRuntime
};
