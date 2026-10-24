const { naiveWallClockToTimestamp } = require('./assessmentConfigUtils');
function isReleased(enabled, scheduledTime, now = Date.now()) {
  if (!(enabled === true || enabled === 1 || enabled === '1')) return false;
  if (!scheduledTime) return true;
  const text = String(scheduledTime);
  const timestamp = /(?:Z|[+-]\d\d:\d\d)$/.test(text)
    ? new Date(text).getTime()
    : naiveWallClockToTimestamp(text);
  return Number.isFinite(timestamp) && timestamp <= now;
}
module.exports = { isReleased };
