# Railway GCS Setup Guide

## Problem

Getting this error when uploading photos:
```
Could not load the default credentials. Browse to https://cloud.google.com/docs/authentication/getting-started for more information.
```

This means the GCS credentials are not properly configured on Railway.

## Solution

You need to add **ONE** of these environment variable sets to Railway:

### Option 1: Base64 Service Account Key (Recommended ✅)

This is the simplest option. Add these 3 variables to Railway:

```bash
GCP_SERVICE_ACCOUNT_KEY_BASE64=ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOi...
GCS_PROJECT_ID=seniorhub-488317
GCS_BUCKET_NAME=seniorhub-photos
```

**How to get the base64 key:**
```bash
cat ~/Downloads/seniorhub-488317-a886aa8230fb.json | base64
```

This will give you the long base64 string to use.

### Option 2: Individual Credentials

If you prefer, you can set individual fields:

```bash
GCS_PROJECT_ID=seniorhub-488317
GCS_BUCKET_NAME=seniorhub-photos
GCS_CLIENT_EMAIL=seniorhub-storage@seniorhub-488317.iam.gserviceaccount.com
GCS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhki...
```

⚠️ **Important for GCS_PRIVATE_KEY:**
- The private key must have `\n` as literal characters (not actual newlines)
- Copy the entire key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`

## Steps to Configure on Railway

1. Go to your Railway project: https://railway.app/project/[your-project-id]
2. Click on your backend service
3. Go to "Variables" tab
4. Click "+ New Variable"
5. Add the 3 variables from Option 1 (recommended)
6. Railway will automatically redeploy

## Verify Configuration

After Railway redeploys, check the logs. You should see:

```
[Storage] Initializing storage service: {
  provider: 'gcs',
  hasGcpServiceAccountKeyBase64: true,
  hasGcsProjectId: true,
  hasGcsBucketName: true,
  hasGcsClientEmail: false,
  hasGcsPrivateKey: false,
  ...
}
[GCS] Using Option 1: Base64 encoded service account key
[GCS] ✅ Initialized successfully with bucket: seniorhub-photos
```

## Test Upload

Once configured, try uploading a photo again. It should work!

## Troubleshooting

### Still getting credentials error?

1. Check Railway logs for the `[Storage]` and `[GCS]` initialization messages
2. Verify all 3 env vars are set (GCP_SERVICE_ACCOUNT_KEY_BASE64, GCS_PROJECT_ID, GCS_BUCKET_NAME)
3. Make sure the base64 string is complete (no line breaks)
4. Try redeploying manually if auto-deploy didn't work

### How to manually redeploy?

1. Go to Railway project
2. Click on backend service
3. Click "Deployments" tab
4. Click "..." on latest deployment
5. Click "Redeploy"

## Current GCS Configuration

```
Project ID: seniorhub-488317
Bucket: seniorhub-photos
Service Account: seniorhub-storage@seniorhub-488317.iam.gserviceaccount.com
Region: europe-west1
```

The bucket already exists and is ready to use. You just need to add the credentials to Railway.
