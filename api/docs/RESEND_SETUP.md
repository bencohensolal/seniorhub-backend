# Resend Email Setup Guide

This guide explains how to configure Resend for sending real invitation emails in production.

## Why Resend?

- Modern, developer-friendly email API
- Free tier: 100 emails/day, 3,000/month
- Simple integration with excellent deliverability
- Built-in domain verification and monitoring

## Setup Steps

### 1. Create Resend Account

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address

### 2. Get API Key

1. Navigate to [API Keys](https://resend.com/api-keys)
2. Click "Create API Key"
3. Give it a name (e.g., "Senior Hub Production")
4. Select the appropriate permissions (default "Sending access" is fine)
5. Copy the API key (starts with `re_`)
6. **Important:** Store it securely - you won't be able to see it again!

### 3. Verify Your Domain (Production)

For production use, you need to verify your sending domain:

1. Go to [Domains](https://resend.com/domains)
2. Click "Add Domain"
3. Enter your domain (e.g., `seniorhub.app`)
4. Add the DNS records shown to your domain's DNS settings
5. Wait for verification (usually takes a few minutes)

**For testing:** You can use `onboarding@resend.dev` without domain verification, but emails will have a warning banner.

### 4. Configure Railway

In your Railway project, set these environment variables:

```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=Senior Hub <noreply@seniorhub.app>
```

**Important notes:**
- Use your verified domain in `EMAIL_FROM`
- Format: `Display Name <email@domain.com>`
- For testing: `Senior Hub <onboarding@resend.dev>`

### 5. Deploy and Test

After setting the variables:

1. Redeploy your Railway service
2. Check logs to confirm: `[Email] Using Resend email provider`
3. Create a test household and invite someone
4. Check Resend dashboard for email delivery status

## Monitoring

### Check Email Status

1. Go to [Resend Emails](https://resend.com/emails)
2. View delivery status, opens, clicks
3. Debug any failures

### API Metrics

Your API exposes invitation email metrics:

```bash
GET /v1/observability/invitations/email-metrics
```

Returns:
- Total emails queued
- Successfully sent
- Failed to send
- Retry statistics

## Troubleshooting

### Emails Not Sending

1. **Check Railway logs** for error messages
2. **Verify API key** is correct in Railway variables
3. **Check domain verification** in Resend dashboard
4. **Review email limits** (free tier: 100/day, 3000/month)

### Common Errors

**"Domain not verified"**
- Solution: Add DNS records or use `onboarding@resend.dev` for testing

**"API key invalid"**
- Solution: Generate a new API key and update Railway variable

**"Rate limit exceeded"**
- Solution: Upgrade Resend plan or wait for rate limit reset

## Development vs Production

### Development (Local)
```bash
# .env
EMAIL_PROVIDER=console
```
Emails printed to console, no real sending.

### Staging/Testing
```bash
# Railway staging environment
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_test_key
EMAIL_FROM=Senior Hub <onboarding@resend.dev>
```
Real emails sent, but with test domain.

### Production
```bash
# Railway production environment
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_live_key
EMAIL_FROM=Senior Hub <noreply@seniorhub.app>
```
Real emails sent from verified domain.

## Cost Estimation

**Resend Free Tier:**
- 100 emails/day
- 3,000 emails/month
- $0.00

**Resend Pro ($20/month):**
- 50,000 emails/month
- Additional emails: $1/1,000

**Typical usage for Senior Hub:**
- 1 household creation = 0-10 invitations
- 100 households/month = ~500-1000 emails
- **Free tier should be sufficient for early stage**

## Security Best Practices

1. **Never commit API keys** to git
2. **Use different keys** for staging/production
3. **Rotate keys** periodically
4. **Monitor usage** in Resend dashboard
5. **Set up alerts** for quota limits

## Support

- **Resend Docs:** https://resend.com/docs
- **Resend Support:** support@resend.com
- **Backend Issues:** Check Railway logs and `/v1/observability/invitations/email-metrics`
