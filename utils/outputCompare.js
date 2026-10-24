/**
 * Normalize program stdout for comparison (line endings, trailing whitespace).
 */
function normalizeProgramOutput(value) {
  if (value == null) return '';
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function outputsMatch(actual, expected) {
  return normalizeProgramOutput(actual) === normalizeProgramOutput(expected);
}

module.exports = { normalizeProgramOutput, outputsMatch };
