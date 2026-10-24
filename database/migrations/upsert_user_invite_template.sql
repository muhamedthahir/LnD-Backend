-- Migration: Upsert USER_INVITE mailer template for OTP / account invite emails
INSERT INTO mailer_templates (
  unique_id,
  name,
  description,
  type,
  category,
  subject,
  preview_text,
  html_template,
  text_template,
  template_format,
  has_dynamic_variables,
  variables,
  is_active,
  priority,
  version
)
VALUES (
  'USER_INVITE',
  'User Invite / OTP',
  'Welcome email with OTP for new user account setup',
  'transactional',
  'user_invite',
  'Welcome to {{platform_name}} - Verify Your Account',
  'Your OTP to set your password',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">'
  '<h2 style="color: #1e3a5f;">Welcome to {{platform_name}}!</h2>'
  '<p>Hello {{name}},</p>'
  '<p>Your account has been created. Please use the following OTP to set your password:</p>'
  '<div style="background: #f5f7fa; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">'
  '<h1 style="color: #1e3a5f; font-size: 32px; margin: 0; letter-spacing: 8px;">{{otp}}</h1>'
  '</div>'
  '<p><strong>This OTP is valid for {{validity}}.</strong></p>'
  '<p>Enter this OTP in the password field during your first login to set your password.</p>'
  '<p>If you did not request this account, please ignore this email.</p>'
  '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">'
  '<p style="color: #718096; font-size: 12px;">This is an automated message. Please do not reply.</p>'
  '</div>',
  'Welcome to {{platform_name}}!\n\nHello {{name}},\n\nYour OTP is: {{otp}}\n\nThis OTP is valid for {{validity}}.\n\nEnter this OTP in the password field during your first login to set your password.',
  'both',
  TRUE,
  JSON_ARRAY('name', 'user_name', 'userName', 'otp', 'OTP', 'email', 'platform_name', 'validity'),
  TRUE,
  0,
  1
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  type = VALUES(type),
  category = VALUES(category),
  subject = VALUES(subject),
  preview_text = VALUES(preview_text),
  html_template = VALUES(html_template),
  text_template = VALUES(text_template),
  template_format = VALUES(template_format),
  has_dynamic_variables = VALUES(has_dynamic_variables),
  variables = VALUES(variables),
  is_active = VALUES(is_active),
  priority = VALUES(priority),
  version = version + 1,
  updated_at = CURRENT_TIMESTAMP;
