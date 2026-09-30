const { test, describe, beforeEach, afterEach, after, mock } = require('node:test');
const assert = require('node:assert/strict');

const Institution = require('../models/Institution');
const User = require('../models/User');
const sesEmailService = require('../services/sesEmailService');
const InstitutionController = require('../controllers/institutionController');
const pool = require('../config/db');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

describe('POST create institution controller', () => {
  let originals;

  beforeEach(() => {
    originals = {
      findByName: Institution.findByName,
      create: Institution.create,
      findById: Institution.findById,
      getAdmins: Institution.getAdmins,
      findByEmail: User.findByEmail,
      createUser: User.create,
      sendEmail: sesEmailService.sendOTPEmailWithTemplate
    };
  });

  afterEach(() => {
    Institution.findByName = originals.findByName;
    Institution.create = originals.create;
    Institution.findById = originals.findById;
    Institution.getAdmins = originals.getAdmins;
    User.findByEmail = originals.findByEmail;
    User.create = originals.createUser;
    sesEmailService.sendOTPEmailWithTemplate = originals.sendEmail;
    mock.restoreAll();
  });

  after(async () => {
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  });

  test('creates institution with address and a new college admin', async () => {
    const createdRecords = [];
    const createdUsers = [];

    Institution.findByName = async () => null;
    Institution.create = async (data) => {
      createdRecords.push(data);
      return 77;
    };
    Institution.findById = async (id) => ({
      id,
      name: 'CampusZen-Learning',
      address: 'Namakkal',
      status: 'active'
    });
    Institution.getAdmins = async () => [
      { id: 9, name: 'Janarthanan P', email: 'janarthanan12102005@gmail.com', role: 'college_admin' }
    ];
    User.findByEmail = async () => null;
    User.create = async (data) => {
      createdUsers.push(data);
      return 9;
    };
    sesEmailService.sendOTPEmailWithTemplate = async () => ({ success: true });

    const req = {
      user: { id: 1, role: 'primary_admin' },
      body: {
        name: 'CampusZen-Learning',
        admin_name: 'Janarthanan P',
        admin_email: 'janarthanan12102005@gmail.com',
        address: 'Namakkal',
        spoc_contact_number: '+917092423672',
        alternate_contact: '',
        alternate_email: 'janarthanan12102005@gmail.com',
        status: 'active'
      }
    };
    const res = mockRes();

    await InstitutionController.createInstitution(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.message, 'Institution created successfully');
    assert.equal(res.body.institution.address, 'Namakkal');
    assert.equal(createdRecords.length, 1);
    assert.equal(createdRecords[0].address, 'Namakkal');
    assert.equal(createdRecords[0].name, 'CampusZen-Learning');
    assert.equal(createdUsers.length, 1);
    assert.equal(createdUsers[0].role, 'college_admin');
    assert.equal(createdUsers[0].college_name, 'CampusZen-Learning');
    assert.equal(createdUsers[0].email, 'janarthanan12102005@gmail.com');
  });

  test('does not create when the institution name already exists', async () => {
    let created = false;
    Institution.findByName = async () => ({ id: 1, name: 'Sona' });
    Institution.create = async () => {
      created = true;
      return 1;
    };

    const res = mockRes();
    await InstitutionController.createInstitution(
      { body: { name: 'Sona', admin_name: 'Admin', admin_email: 'admin@sona.edu' } },
      res
    );

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /already exists/i);
    assert.equal(created, false);
  });

  test('rejects create when required fields are missing', async () => {
    const res = mockRes();
    await InstitutionController.createInstitution({ body: { name: 'Only Name' } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /required/i);
  });
});
