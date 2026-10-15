const { createBulkStudentUploadService } = require('./bulkStudentUploadService');
const User = require('../models/User');
const Department = require('../models/Department');
const Degree = require('../models/Degree');
const { generateOTP, getOTPExpiration } = require('../utils/otpGenerator');
const { sendOTPEmailWithTemplate } = require('./sesEmailService');
module.exports = createBulkStudentUploadService({
  db: require('../config/db'), createUser: (data, connection) => User.create(data, connection),
  ensureDepartment: name => Department.ensureExists(name), ensureDegree: name => Degree.ensureExists(name),
  generateOTP, getOTPExpiration, sendInvite: sendOTPEmailWithTemplate
});
