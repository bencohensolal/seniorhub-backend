#!/bin/bash

# Script to run a specific migration on Railway database
# Usage: ./scripts-db/run-railway-migration.sh <migration_number>
# Example: ./scripts-db/run-railway-migration.sh 016

set -e

MIGRATION_NUMBER="${1}"

if [ -z "$MIGRATION_NUMBER" ]; then
  echo "Error: Migration number required"
  echo "Usage: $0 <migration_number>"
  echo "Example: $0 016"
  exit 1
fi

# Pad migration number to 3 digits
MIGRATION_NUMBER=$(printf "%03d" "$MIGRATION_NUMBER")

# Find the migration file
MIGRATION_FILE=$(find migrations -name "${MIGRATION_NUMBER}_*.sql" | head -n 1)

if [ -z "$MIGRATION_FILE" ]; then
  echo "Error: Migration file not found for number ${MIGRATION_NUMBER}"
  echo "Available migrations:"
  ls -1 migrations/*.sql
  exit 1
fi

echo "=================================================="
echo "Railway Migration Runner"
echo "=================================================="
echo "Migration file: $MIGRATION_FILE"
echo ""

# Get Railway DATABASE_URL
echo "Fetching Railway DATABASE_URL..."
DATABASE_URL=$(railway variables get DATABASE_URL 2>/dev/null || echo "")

if [ -z "$DATABASE_URL" ]; then
  echo "Error: Could not fetch DATABASE_URL from Railway"
  echo "Make sure you're logged in to Railway CLI: railway login"
  echo "And linked to the correct project: railway link"
  exit 1
fi

echo "Connected to Railway database"
echo ""
echo "Executing migration: $MIGRATION_FILE"
echo "=================================================="
echo ""

# Execute the migration using psql
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

echo ""
echo "=================================================="
echo "✅ Migration $MIGRATION_NUMBER executed successfully!"
echo "=================================================="
