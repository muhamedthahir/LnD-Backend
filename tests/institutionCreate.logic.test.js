const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCreateInstitutionInput,
  normalizeInstitutionCreatePayload
} = require('../utils/institutionCreateLogic');

describe('institution create logic', () => {
  test('rejects missing required fields', () => {
    const result = validateCreateInstitutionInput({
      name: '',
      admin_name: 'Ada',
      admin_email: 'ada@college.edu'
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.match(result.error, /name, admin name, and admin email/i);
  });

  test('rejects invalid alternate email', () => {
    const result = validateCreateInstitutionInput({
      name: 'CampusZen Learning',
      admin_name: 'Janarthanan P',
      admin_email: 'janar@college.edu',
      alternate_email: 'not-an-email'
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Invalid alternate email format');
  });

  test('accepts a complete create payload including address', () => {
    const result = validateCreateInstitutionInput({
      name: 'CampusZen-Learning',
      admin_name: 'Janarthanan P',
      admin_email: 'janarthanan12102005@gmail.com',
      address: 'Namakkal',
      spoc_contact_number: '+917092423672',
      alternate_email: 'janarthanan12102005@gmail.com',
      status: 'active'
    });
    assert.equal(result.ok, true);
  });

  test('normalizes blanks to null and defaults status to active', () => {
    const payload = normalizeInstitutionCreatePayload({
      name: '  CampusZen-Learning  ',
      admin_name: '  Janarthanan P ',
      admin_email: ' janarthanan12102005@gmail.com ',
      address: 'Namakkal',
      spoc_contact_number: ' ',
      alternate_contact: '',
      alternate_email: '',
      status: 'unknown'
    });

    assert.deepEqual(payload, {
      name: 'CampusZen-Learning',
      admin_name: 'Janarthanan P',
      admin_email: 'janarthanan12102005@gmail.com',
      address: 'Namakkal',
      spoc_contact_number: null,
      alternate_contact: null,
      alternate_email: null,
      status: 'active'
    });
  });

  test('keeps inactive status when requested', () => {
    const payload = normalizeInstitutionCreatePayload({
      name: 'SVCE',
      admin_name: 'Admin',
      admin_email: 'admin@svce.edu',
      status: 'inactive'
    });
    assert.equal(payload.status, 'inactive');
    assert.equal(payload.address, null);
  });
});
