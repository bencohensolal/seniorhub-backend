#!/bin/bash
# Fix Railway deployment by resetting email to console mode

echo "🔧 Réinitialisation EMAIL_PROVIDER en mode console..."

cd /Users/benjamincohensolal/workspaces/seniorhub/backend

# Remettre en mode console temporairement
railway variables --set EMAIL_PROVIDER=console

# Supprimer les variables Gmail mal configurées
railway variables --unset GMAIL_USER 2>/dev/null || true
railway variables --unset GMAIL_APP_PASSWORD 2>/dev/null || true
railway variables --unset EMAIL_FROM 2>/dev/null || true

echo "✅ Configuration réinitialisée!"
echo ""
echo "Le service va redémarrer en mode console (emails dans les logs)."
echo ""
echo "Pour activer Gmail plus tard:"
echo "1. Obtenez votre App Password: https://myaccount.google.com/apppasswords"
echo "2. Suivez le guide: RAILWAY_EMAIL_SETUP.md"
