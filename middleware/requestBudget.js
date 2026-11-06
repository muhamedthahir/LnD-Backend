function requestBudget(max, windowMs, key = req => req.ip) {
  const buckets = new Map();
  let nextCleanup = 0;
  return (req, res, next) => {
    const now = Date.now();
    if (now >= nextCleanup) {
      for (const [id, bucket] of buckets) {
        if (bucket.until <= now) buckets.delete(id);
      }
      nextCleanup = now + windowMs;
    }
    const id = key(req);
    let bucket = buckets.get(id);
    if (!bucket || bucket.until <= now) {
      if (!bucket && buckets.size >= 10000) return res.status(429).json({ error: 'Service busy' });
      bucket = { count: 0, until: now + windowMs };
      buckets.set(id, bucket);
    }
    if (++bucket.count > max) {
      res.set('Retry-After', String(Math.ceil((bucket.until - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
  };
}

module.exports = requestBudget;
