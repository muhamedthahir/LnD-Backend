const nodemailer = require('nodemailer');

// Create transporter - using Gmail as default (free)
// For production, use environment variables
const createTransporter = async () => {
  // Option 1: Gmail (requires app password)
  if ((process.env.EMAIL_SERVICE === 'gmail' || !process.env.EMAIL_SERVICE) && process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD // Gmail App Password
      }
    });
  }

  // Option 2: Custom SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }

  // Option 3: Ethereal Email (free test account) - fallback
  if (process.env.NODE_ENV === 'development') {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  }

  return null; // No email configured
};

const sendOTPEmail = async (email, name, otp) => {
  try {
    const transporter = await createTransporter();

    if (!transporter) {
      // No email configured - log OTP for development
      console.log(`\n========================================`);
      console.log(`[EMAIL NOT CONFIGURED] OTP for ${email}:`);
      console.log(`OTP: ${otp}`);
      console.log(`Valid for 7 days`);
      console.log(`========================================\n`);
      return true; // Don't fail, just log
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@edtech.com',
      to: email,
      subject: 'Welcome! Verify Your Account - OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a5f;">Welcome to EdTech Platform!</h2>
          <p>Hello ${name},</p>
          <p>Your account has been created. Please use the following OTP to set your password:</p>
          <div style="background: #f5f7fa; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #1e3a5f; font-size: 32px; margin: 0; letter-spacing: 8px;">${otp}</h1>
          </div>
          <p><strong>This OTP is valid for 7 days.</strong></p>
          <p>Please enter this OTP in the password field during your first login to set your password.</p>
          <p>If you did not request this account, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #718096; font-size: 12px;">This is an automated message. Please do not reply.</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    
    // If using Ethereal, log the preview URL
    if (process.env.NODE_ENV === 'development' && info.messageId.includes('ethereal')) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('Preview URL:', previewUrl);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    // Always log OTP in development even if email fails
    console.log(`\n[EMAIL FAILED] OTP for ${email}: ${otp}\n`);
    // Don't throw error - allow user creation to continue
    return true;
  }
};

module.exports = {
  sendOTPEmail
};

