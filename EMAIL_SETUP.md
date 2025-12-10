# Email Configuration for OTP

This application uses nodemailer to send OTP emails. Here are free options:

## Option 1: Gmail (Recommended for Development)

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
3. Add to your `.env` file:
   ```
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_APP_PASSWORD=your-16-char-app-password
   EMAIL_FROM=your-email@gmail.com
   ```

## Option 2: Ethereal Email (Free Testing - No Setup Required)

Ethereal Email provides a free testing email service. The app will automatically use it in development mode if Gmail is not configured.

## Option 3: Other SMTP Services

You can use any SMTP service. Add to `.env`:
```
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
EMAIL_FROM=your-email@example.com
```

## Development Mode

If email is not configured, the OTP will be logged to the console in development mode for testing purposes.

