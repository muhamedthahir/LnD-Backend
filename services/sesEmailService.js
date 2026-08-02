// sesEmailService.js - AWS SES Email Service

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const MailerTemplate = require('../models/MailerTemplate');
const MailStatus = require('../models/MailStatus');

// Initialize SES Client
const getSESClient = () => {
  return new SESClient({
    region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
};

/**
 * Check if SES is configured
 * @returns {boolean}
 */
const isSESConfigured = () => {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    (process.env.AWS_SES_REGION || process.env.AWS_REGION)
  );
};

/**
 * Replace template variables with actual values
 * @param {string} template - The template string with {{variable}} placeholders
 * @param {object} variables - Object with variable values
 * @returns {string} - Template with replaced variables
 */
const replaceTemplateVariables = (template, variables = {}) => {
  if (!template) return '';
  
  let result = template;
  
  // Replace {{variable}} format
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    result = result.replace(regex, variables[key] || '');
  });
  
  // Also support {variable} format
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`\\{\\s*${key}\\s*\\}`, 'gi');
    result = result.replace(regex, variables[key] || '');
  });
  
  return result;
};

/**
 * Send email using AWS SES
 * @param {object} params - Email parameters
 * @returns {Promise<object>} - Result of email sending
 */
const sendEmail = async ({
  to,
  subject,
  htmlBody,
  textBody,
  from,
  replyTo,
  templateId = null,
  variables = {},
  userId = null
}) => {
  const startTime = new Date();
  let mailStatusId = null;
  
  // Default sender
  const defaultFrom = process.env.SES_DEFAULT_FROM || process.env.EMAIL_FROM || 'noreply@campuszen.in';
  const senderEmail = from || defaultFrom;
  
  // Prepare email content
  const finalSubject = replaceTemplateVariables(subject, variables);
  const finalHtml = replaceTemplateVariables(htmlBody, variables);
  const finalText = replaceTemplateVariables(textBody, variables);
  
  // Create initial mail status record
  try {
    mailStatusId = await MailStatus.create({
      mailer_template_id: templateId,
      status: 'pending',
      message: 'Email queued for sending',
      to_address: Array.isArray(to) ? to.join(', ') : to,
      from_address: senderEmail,
      subject: finalSubject,
      sent_by: userId
    });
  } catch (err) {
    console.error('Error creating mail status record:', err);
  }

  // Check if SES is configured
  if (!isSESConfigured()) {
    console.log('\n========================================');
    console.log('[SES NOT CONFIGURED] Email details:');
    console.log(`To: ${to}`);
    console.log(`From: ${senderEmail}`);
    console.log(`Subject: ${finalSubject}`);
    console.log(`Body: ${finalText || finalHtml}`);
    console.log('========================================\n');
    
    // Update status to skipped (no SES configured)
    if (mailStatusId) {
      await MailStatus.update(mailStatusId, {
        status: 'skipped',
        message: 'SES not configured - email logged to console',
        sent_at: new Date()
      });
    }
    
    return {
      success: true,
      message: 'Email logged (SES not configured)',
      mailStatusId
    };
  }

  try {
    const sesClient = getSESClient();
    
    const toAddresses = Array.isArray(to) ? to : [to];
    
    const emailParams = {
      Source: senderEmail,
      Destination: {
        ToAddresses: toAddresses
      },
      Message: {
        Subject: {
          Data: finalSubject,
          Charset: 'UTF-8'
        },
        Body: {}
      }
    };
    
    // Add HTML body if provided
    if (finalHtml) {
      emailParams.Message.Body.Html = {
        Data: finalHtml,
        Charset: 'UTF-8'
      };
    }
    
    // Add text body if provided
    if (finalText) {
      emailParams.Message.Body.Text = {
        Data: finalText,
        Charset: 'UTF-8'
      };
    }
    
    // Add reply-to if provided
    if (replyTo) {
      emailParams.ReplyToAddresses = [replyTo];
    }
    
    const command = new SendEmailCommand(emailParams);
    const response = await sesClient.send(command);
    
    console.log(`Email sent successfully to ${to}. MessageId: ${response.MessageId}`);
    
    // Update mail status to success
    if (mailStatusId) {
      await MailStatus.update(mailStatusId, {
        status: 'success',
        message: `Email sent successfully. MessageId: ${response.MessageId}`,
        sent_at: new Date(),
        message_id: response.MessageId
      });
    }
    
    // Update template usage count
    if (templateId) {
      try {
        await MailerTemplate.incrementUsage(templateId);
      } catch (err) {
        console.error('Error incrementing template usage:', err);
      }
    }
    
    return {
      success: true,
      messageId: response.MessageId,
      mailStatusId
    };
    
  } catch (error) {
    console.error('Error sending email via SES:', error);
    
    // Update mail status to failure
    if (mailStatusId) {
      await MailStatus.update(mailStatusId, {
        status: 'failure',
        message: `Failed to send email: ${error.message}`,
        error_code: error.code || error.name,
        error_details: JSON.stringify({
          name: error.name,
          code: error.code,
          message: error.message
        })
      });
    }
    
    return {
      success: false,
      error: error.message,
      mailStatusId
    };
  }
};

/**
 * Send email using a mailer template
 * @param {object} params - Template email parameters
 * @returns {Promise<object>} - Result of email sending
 */
const sendTemplateEmail = async ({
  templateUniqueId,
  to,
  variables = {},
  userId = null
}) => {
  try {
    // Fetch the template
    const template = await MailerTemplate.findByUniqueId(templateUniqueId);
    
    if (!template) {
      console.error(`Template not found: ${templateUniqueId}`);
      return {
        success: false,
        error: `Template not found: ${templateUniqueId}`
      };
    }
    
    if (!template.is_active) {
      console.error(`Template is not active: ${templateUniqueId}`);
      return {
        success: false,
        error: `Template is not active: ${templateUniqueId}`
      };
    }
    
    // Send email using template
    return await sendEmail({
      to,
      subject: template.subject,
      htmlBody: template.html_template,
      textBody: template.text_template,
      from: template.default_sender_email || undefined,
      replyTo: template.default_reply_to || undefined,
      templateId: template.id,
      variables,
      userId
    });
    
  } catch (error) {
    console.error('Error sending template email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send OTP email using USER_INVITE template
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} otp - OTP code
 * @param {number} userId - User ID who triggered the email (optional)
 * @returns {Promise<object>} - Result of email sending
 */
const sendOTPEmailWithTemplate = async (email, name, otp, userId = null) => {
  // Try to use the USER_INVITE template first
  const result = await sendTemplateEmail({
    templateUniqueId: 'USER_INVITE',
    to: email,
    variables: {
      name: name,
      user_name: name,
      userName: name,
      otp: otp,
      OTP: otp,
      email: email,
      platform_name: process.env.PLATFORM_NAME || 'LnD Platform',
      validity: '7 days'
    },
    userId
  });
  
  // If template not found, fall back to default email
  if (!result.success && result.error?.includes('Template not found')) {
    console.log('USER_INVITE template not found, using default OTP email format');
    
    return await sendEmail({
      to: email,
      subject: 'Welcome! Verify Your Account - OTP',
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a5f;">Welcome to ${process.env.PLATFORM_NAME || 'LnD Platform'}!</h2>
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
      `,
      textBody: `Welcome to ${process.env.PLATFORM_NAME || 'LnD Platform'}!\n\nHello ${name},\n\nYour OTP is: ${otp}\n\nThis OTP is valid for 7 days.\n\nPlease enter this OTP in the password field during your first login to set your password.`,
      userId
    });
  }
  
  return result;
};

/**
 * Verify SES email address (for testing)
 * @param {string} email - Email address to verify
 * @returns {Promise<object>} - Result
 */
const verifySESEmail = async (email) => {
  if (!isSESConfigured()) {
    return { success: false, error: 'SES not configured' };
  }
  
  try {
    const { VerifyEmailIdentityCommand } = require('@aws-sdk/client-ses');
    const sesClient = getSESClient();
    
    const command = new VerifyEmailIdentityCommand({
      EmailAddress: email
    });
    
    await sesClient.send(command);
    
    return {
      success: true,
      message: `Verification email sent to ${email}. Please check your inbox and click the verification link.`
    };
  } catch (error) {
    console.error('Error verifying SES email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

const sendPasswordResetEmail = async (email, name, resetLink, userId = null) => {
  const result = await sendTemplateEmail({
    templateUniqueId: 'reset-password',
    to: email,
    variables: {
      name: name || '',
      email,
      reset_link: resetLink
    },
    userId
  });

  if (!result.success && result.error?.includes('Template not found')) {
    return await sendEmail({
      to: email,
      subject: 'Reset your password',
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a5f;">Reset your password</h2>
          <p>Hello ${name || 'there'},</p>
          <p>We received a request to reset the password for ${email}.</p>
          <p><a href="${resetLink}">Reset Password</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
      textBody: `Reset your password\n\nHello ${name || 'there'},\n\nReset link: ${resetLink}\n\nIf you did not request this, you can ignore this email.`,
      userId
    });
  }

  return result;
};

const getSESStatus = () => ({
  configured: isSESConfigured(),
  region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
  defaultFrom: process.env.SES_DEFAULT_FROM || process.env.EMAIL_FROM || 'noreply@campuszen.in',
  platformName: process.env.PLATFORM_NAME || 'LnD Platform'
});

module.exports = {
  sendEmail,
  sendTemplateEmail,
  sendOTPEmailWithTemplate,
  sendPasswordResetEmail,
  isSESConfigured,
  getSESStatus,
  replaceTemplateVariables,
  verifySESEmail
};

