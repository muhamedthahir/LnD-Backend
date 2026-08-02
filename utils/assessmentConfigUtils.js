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

/** Minutes east of UTC for wall-clock datetimes entered in the admin UI (IST default). */
const APP_TIMEZONE_OFFSET_MINUTES = Number(process.env.APP_TIMEZONE_OFFSET_MINUTES ?? 330);

/**
 * Convert a naive wall-clock datetime string to UTC epoch ms.
 */
const naiveWallClockToTimestamp = (value) => {
  const parts = parseNaiveDateTime(value);
  if (!parts) return null;

  const utcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hours),
    Number(parts.minutes),
    Number(parts.seconds)
  );

  return utcMs - APP_TIMEZONE_OFFSET_MINUTES * 60 * 1000;
};

const isAssessmentNotStartedYet = (startDateTime) => {
  const ts = naiveWallClockToTimestamp(startDateTime);
  if (ts === null) return false;
  return ts > Date.now();
};

const isAssessmentExpired = (endDateTime) => {
  const ts = naiveWallClockToTimestamp(endDateTime);
  if (ts === null) return false;
  return ts < Date.now();
};

/**
 * Normalize datetime-local / ISO strings for MySQL DATETIME columns.
 * Returns null for empty values.
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
  parseNaiveDateTime,
  naiveWallClockToTimestamp,
  isAssessmentNotStartedYet,
  isAssessmentExpired,
  APP_TIMEZONE_OFFSET_MINUTES
};
