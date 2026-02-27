# Railway Deployment Resolution

## Problem Summary

Railway deployments were failing with persistent Docker cache mount conflicts:
```
rm: cannot remove 'node_modules/.cache': Device or resource busy
```

The service was completely DOWN, returning "Application not found" 404 errors.

## Root Cause

The `buildCommand` in `railway.toml` was interfering with Docker's internal cache mount management:
```toml
# PROBLEMATIC CONFIGURATION
[build]
builder = "NIXPACKS"
buildCommand = "npm ci --cache /tmp/.npm && npm run build"
```

Even when attempting to redirect the npm cache to `/tmp`, npm internally still tried to clean up `node_modules/.cache`, which is a Docker mounted volume that cannot be deleted during the build process.

## Solution

**Remove the `buildCommand` entirely and let Nixpacks handle the build process natively.**

### Final Configuration

**railway.toml:**
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm run start:railway"
healthcheckPath = "/health"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

**nixpacks.toml** (unchanged):
```toml
[phases.setup]
nixPkgs = ["nodejs_20"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm run start:railway"
```

## Results

✅ **Service is now ONLINE**
- Health endpoint responding: `{"status":"ok"}`
- Service logs show successful startup
- Gmail SMTP provider correctly initialized: `[Email] Using Gmail SMTP provider`

✅ **GET invitations endpoint is WORKING**
- No more 404 "Application not found"
- Endpoint now returns proper 403 "Access denied" for unauthorized users (expected behavior)
- The endpoint code from commit 927d53c is now deployed and functional

✅ **Build process is STABLE**
- No more cache mount conflicts
- Nixpacks handles install and build phases cleanly
- Container starts successfully

## Key Learnings

1. **Avoid custom buildCommands with Nixpacks** - Let Nixpacks manage the build lifecycle through nixpacks.toml phases
2. **Docker cache mounts are system-managed** - User commands cannot modify mounted volumes during build
3. **Separation of concerns** - railway.toml for Railway-specific config, nixpacks.toml for build steps

## Commit

Final fix committed: `ba72968` - "fix(railway): remove buildCommand to prevent cache mount conflicts"

## Date

February 26, 2026 - 11:57 PM CET
