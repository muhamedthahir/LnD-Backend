-- Migration: Upsert reset-password mailer template
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
  'reset-password',
  'Reset Password',
  'Password reset link for users',
  'transactional',
  'password_reset',
  'Reset your password',
  'Use this link to reset your password',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">'
  '<h2 style="color: #1e3a5f;">Reset your password</h2>'
  '<p>Hello {{name}},</p>'
  '<p>We received a request to reset the password for {{email}}.</p>'
  '<p>Click the button below to set a new password:</p>'
  '<p style="margin: 24px 0;">'
  '<a href="{{reset_link}}" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 6px; display: inline-block;">Reset Password</a>'
  '</p>'
  '<p>If you did not request this, you can ignore this email.</p>'
  '<p style="color: #718096; font-size: 12px;">This link will expire in 1 hour.</p>'
  '</div>',
  'Reset your password\n\nHello {{name}},\nWe received a request to reset the password for {{email}}.\n\nReset link: {{reset_link}}\n\nIf you did not request this, you can ignore this email.\nThis link will expire in 1 hour.',
  'both',
  TRUE,
  JSON_ARRAY('name', 'email', 'reset_link'),
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

