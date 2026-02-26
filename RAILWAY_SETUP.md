# Railway Setup Guide

## Re-linking Railway to the Project

After moving the project structure from `api/` to the root, Railway needs to be re-linked.

### Step 1: Link Railway Project

```bash
# Link to your Railway project
railway link

# This will prompt you to:
# 1. Select your team/account
# 2. Select your project (Senior Hub)
# 3. Select the environment (production)
```

This will create a `.railway.json` file that connects your local project to Railway.

### Step 2: Verify Connection

```bash
# Check linked project
railway status

# View variables
railway variables
```

### Step 3: Update Railway Project Settings

Since the code is now at the root level (not in `api/`):

1. Go to https://railway.app
2. Select your "Senior Hub" project
3. Select your backend service
4. Go to **Settings** → **Build & Deploy**
5. **Remove** the "Root Directory" setting (it should be empty or `/`)
6. Save changes

### Step 4: Test the Setup

```bash
# This should now work
npm run db:clear:railway
```

## Alternative: Manual Database URL

If you don't want to link Railway locally, you can still use the scripts:

```bash
# The script will prompt you for the DATABASE_PUBLIC_URL
npm run db:clear:railway

# Or set it directly
DATABASE_URL="postgresql://..." npx tsx src/scripts/clearDatabase.ts
```

## Railway Configuration Files

The project now has Railway configuration at the root:

- **railway.toml** - Build and deploy configuration
- **nixpacks.toml** - Build system configuration
- **.railway.json** - Project link file (created by `railway link`, should be in .gitignore)

## Important Notes

⚠️ Make sure to add `.railway.json` to `.gitignore` if not already there (it contains sensitive project IDs).

✅ The build commands in `railway.toml` and `nixpacks.toml` have already been updated to work from the root directory.
