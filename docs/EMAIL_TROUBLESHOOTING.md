# Email Troubleshooting Guide

## Problem: Invitation Emails Not Being Sent

This guide helps diagnose why invitation emails may not be received by invitees.

## Symptoms

- Invitation is created successfully in database
- Status = "pending"
- No email received by invitee
- No obvious errors in logs

## Architecture Overview

```
Route Handler → Use Case → Repository → Email Queue → Email Provider → Recipient
    ↓             ↓           ↓              ↓              ↓
  Logs        No email    No email      Async job      Provider
  request     logic       logic         processing     specific
```

**Key Point**: Email sending happens AFTER the invitation is created in the database, in the route handler layer.

## Diagnostic Steps

### 1. Check Email Provider Configuration

The email provider is configured via environment variables. Check your `.env` file:

```bash
# Check current configuration
grep EMAIL .env
```

**Required variables:**

For **Console** mode (development - no emails sent):
```env
EMAIL_PROVIDER=console
```

For **Gmail SMTP**:
```env
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
EMAIL_FROM=Senior Hub <your-email@gmail.com>
```

For **Resend** (recommended for production):
```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=Senior Hub <noreply@seniorhub.app>
```

**Common Issues:**
- ❌ `EMAIL_PROVIDER=console` in production → Emails only logged to console, not sent
- ❌ Missing `EMAIL_FROM` → Provider initialization fails
- ❌ Invalid API key → Authentication errors
- ❌ Unverified domain (Resend) → Emails rejected

### 2. Check Application Startup Logs

When the app starts, it logs which email provider is being used:

```bash
# Look for this in logs:
[Email] Using Console email provider (development mode)
# or
[Email] Using Resend email provider
# or
[Email] Using Gmail SMTP provider
```

If you see "Console email provider" in production, **emails will not be sent**.

For Gmail SMTP, also check for:
```bash
[GmailSmtpProvider] SMTP connection verified successfully
# or
[GmailSmtpProvider] SMTP connection failed: <error message>
```

### 3. Check Invitation Creation Logs

When invitations are created, look for these logs:

```bash
[INVITE] Received bulk invitation request: { householdId: '...', body: {...} }
[Invitations] Enqueuing bulk emails: { count: 2, recipients: ['user1@example.com', 'user2@example.com'] }
```

**If you don't see the "Enqueuing bulk emails" log:**
- The invitation was created but emails were never queued
- Check if there are errors between invitation creation and email queuing

### 4. Check Email Provider Logs

For **Console provider** (development):
```bash
# You should see this in logs:
📧 INVITATION EMAIL (Development Mode - Not Actually Sent)
To: invitee@example.com
Subject: You're invited to join a household on Senior Hub
```

For **Resend provider**:
```bash
[ResendEmailProvider] Email sent successfully to user@example.com (ID: abc123)
# or
[ResendEmailProvider] Error sending email: <error details>
```

For **Gmail SMTP provider**:
```bash
[GmailSmtpProvider] Email sent successfully: { messageId: '...', to: 'user@example.com' }
# or
[GmailSmtpProvider] Failed to send email: { to: 'user@example.com', error: '...' }
```

### 5. Check Email Template Loading

Email templates are loaded from `templates/emails/invitation/`. Verify they exist:

```bash
ls -la templates/emails/invitation/
# Should show:
# subject.txt
# body.txt
# README.md
```

If templates are missing, email sending will fail.

### 6. Check for Silent Failures

The email queue catches errors but doesn't block the API response. Check for error patterns in logs:

```bash
# Search for email-related errors
grep -i "email" logs/app.log | grep -i "error\|failed"
```

### 7. Verify Email Provider Credentials

**For Gmail:**
```bash
# Test SMTP connection manually
curl -v smtps://smtp.gmail.com:465 --user "your-email@gmail.com:your-app-password"
```

**For Resend:**
```bash
# Test API key
curl https://api.resend.com/emails \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "onboarding@resend.dev",
    "to": "your-email@example.com",
    "subject": "Test",
    "html": "<p>Test</p>"
  }'
```

### 8. Check Spam/Junk Folders

Even if emails are sent successfully, they may be filtered as spam:

- Check recipient's spam/junk folder
- Verify sender domain reputation
- For Resend: Use verified domain (not onboarding@resend.dev) in production
- For Gmail: Ensure "Less secure app access" is NOT required (use App Passwords)

### 9. Check Rate Limits

**Application rate limit:**
- Default: Basic in-memory rate limiting
- Check logs for: `Invitation rate limit reached`

**Provider limits:**
- **Console**: No limits (not sent)
- **Gmail**: 500 emails/day (free tier)
- **Resend**: 100 emails/day, 3,000/month (free tier)

### 10. Enable Debug Logging

For more detailed diagnostics, you can temporarily add debug logging to the queue:

Edit `src/data/services/email/InvitationEmailQueue.ts` and add console.log statements in the `processJob` method to see exactly where failures occur.

## Common Scenarios & Solutions

### Scenario 1: "Emails worked before, now they don't"

**Possible causes:**
1. Email provider credentials expired (Gmail App Password revoked, Resend API key rotated)
2. Email provider account suspended or limits reached
3. Environment variables changed or not loaded

**Solution:**
1. Verify current environment variables
2. Check provider dashboard for account status
3. Regenerate credentials if needed

### Scenario 2: "Emails work in development but not production"

**Possible causes:**
1. Production env has `EMAIL_PROVIDER=console`
2. Production credentials not set
3. Different environment variable names in production

**Solution:**
1. Check production environment configuration
2. Verify all required variables are set
3. Test provider credentials from production environment

### Scenario 3: "Some emails sent, others not"

**Possible causes:**
1. Invalid email addresses (malformed, bounced)
2. Specific domains blocked by provider
3. Rate limiting kicking in mid-batch

**Solution:**
1. Check provider logs for specific failures
2. Validate email addresses before sending
3. Implement batch delays if hitting rate limits

### Scenario 4: "Logs say email sent, but not received"

**Possible causes:**
1. Email in spam/junk folder
2. Email server rejected (domain reputation)
3. Recipient's email server issues
4. Email provider showing success but not actually delivering

**Solution:**
1. Check spam folders
2. Use email testing service (mailtrap.io, mailhog)
3. Verify domain authentication (SPF, DKIM for Resend)
4. Contact email provider support with message IDs

## Testing Email Configuration

### Test with Console Provider

```bash
# In .env
EMAIL_PROVIDER=console

# Start server and send invitation
# Check logs for email content
```

### Test with MailDev (Local SMTP Testing)

```bash
# Install MailDev
npm install -g maildev

# Run MailDev
maildev

# Configure app to use MailDev provider
# (Would need to create MailDevEmailProvider)
```

### Test with Real Provider

```bash
# Set up provider (Gmail or Resend)
# Send test invitation to your own email
# Verify receipt and check spam folder
```

## Monitoring Email Delivery

The application includes email metrics:

```typescript
// Access metrics (add endpoint if needed)
invitationEmailRuntime.metrics.getStats()
// Returns: { queued, sent, failed, retries, deadLetter }
```

Consider adding an observability endpoint:
```
GET /v1/households/observability/email-metrics
```

## Emergency Checklist

If emails are critically not working:

- [ ] Check EMAIL_PROVIDER is not "console" in production
- [ ] Verify all required env vars are set (EMAIL_FROM, API keys, etc.)
- [ ] Check application startup logs for provider initialization
- [ ] Check invitation creation logs for "Enqueuing bulk emails"
- [ ] Check provider-specific logs for send success/failure
- [ ] Verify email templates exist in `templates/emails/invitation/`
- [ ] Test provider credentials manually (curl/API dashboard)
- [ ] Check spam folders
- [ ] Verify no rate limits exceeded
- [ ] Check provider dashboard for account status

## Additional Resources

- [Gmail App Password Setup](./GMAIL_SMTP_SETUP.md)
- [Resend Setup Guide](./RESEND_SETUP.md)
- [Email Provider Options](./EMAIL_OPTIONS.md)
- [Email Template Documentation](../templates/emails/invitation/README.md)

## Getting Help

If you've exhausted these troubleshooting steps:

1. Collect relevant logs (startup, invitation creation, email sending)
2. Note your EMAIL_PROVIDER and configuration (sanitize secrets)
3. Document what you've already tried
4. Check provider status pages for outages
5. Contact provider support with specific error messages and message IDs
