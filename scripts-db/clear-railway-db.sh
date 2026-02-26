#!/bin/bash
# Clear all data from Railway PostgreSQL database
# This script can fetch the database URL from Railway or use a provided URL

set -e

cd "$(dirname "$0")/.."

echo "🔍 Attempting to fetch Railway database URL..."

# Try to get the database URL from Railway CLI
PUBLIC_URL=$(railway variables --service postgres --json 2>/dev/null | jq -r '.DATABASE_PUBLIC_URL' 2>/dev/null || echo "")

# If Railway CLI didn't work, try without service specification
if [ -z "$PUBLIC_URL" ] || [ "$PUBLIC_URL" = "null" ]; then
  PUBLIC_URL=$(railway variables --json 2>/dev/null | jq -r '.DATABASE_PUBLIC_URL' 2>/dev/null || echo "")
fi

# If still no URL, try DATABASE_URL
if [ -z "$PUBLIC_URL" ] || [ "$PUBLIC_URL" = "null" ]; then
  PUBLIC_URL=$(railway variables --json 2>/dev/null | jq -r '.DATABASE_URL' 2>/dev/null || echo "")
fi

# If we still don't have a URL, ask the user
if [ -z "$PUBLIC_URL" ] || [ "$PUBLIC_URL" = "null" ]; then
  echo ""
  echo "⚠️  Could not fetch DATABASE_URL automatically from Railway."
  echo ""
  echo "Please provide the DATABASE_PUBLIC_URL manually."
  echo "You can find it in Railway dashboard:"
  echo "  1. Go to your project"
  echo "  2. Select the PostgreSQL service"
  echo "  3. Go to Variables tab"
  echo "  4. Copy DATABASE_PUBLIC_URL"
  echo ""
  echo "Or run: railway variables (if Railway is linked)"
  echo ""
  read -p "Enter DATABASE_PUBLIC_URL: " PUBLIC_URL
  
  if [ -z "$PUBLIC_URL" ]; then
    echo "❌ No URL provided. Exiting."
    exit 1
  fi
fi

echo ""
echo "✅ Database URL obtained"
echo ""
echo "⚠️  WARNING: This will DELETE ALL DATA from the database!"
echo "   Affected tables:"
echo "   - households"
echo "   - household_members"
echo "   - household_invitations"
echo "   - audit_events"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Operation cancelled"
  exit 0
fi

echo ""
echo "🚀 Running database clear script..."
DATABASE_URL="$PUBLIC_URL" npx tsx src/scripts/clearDatabase.ts

echo ""
echo "✅ Database cleared successfully!"
