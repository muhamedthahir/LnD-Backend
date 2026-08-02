/**
 * Parse MySQL/API datetime as wall-clock components (no timezone conversion).
 */
const parseNaiveDateTime = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  return {
    year: match[1],
    month: match[2],
    day: match[3],
    hours: match[4],
    minutes: match[5],
    seconds: match[6] || '00'
  };
};

/**
 * Normalize datetime-local / ISO strings for MySQL DATETIME columns.
 * Values are stored and returned as naive wall-clock times (IST in production use).
 */
const normalizeDateTimeForDb = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  // datetime-local: 2026-08-02T15:30
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed.replace('T', ' ')}:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed.replace('T', ' ');
  }

  const parts = parseNaiveDateTime(trimmed);
  if (parts) {
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hours}:${parts.minutes}:${parts.seconds}`;
  }

  return trimmed;
};

module.exports = {
  normalizeDateTimeForDb,
  parseNaiveDateTime
};
