// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Set OTP expiration to 7 days from now
const getOTPExpiration = () => {
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + 7);
  return expiration;
};

module.exports = {
  generateOTP,
  getOTPExpiration
};

