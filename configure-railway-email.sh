#!/bin/bash
# Configuration des variables Railway pour Gmail SMTP

echo "🔧 Configuration des variables Railway pour Gmail SMTP..."

cd /Users/benjamincohensolal/workspaces/seniorhub/backend

# Définir le provider email
railway variables --set EMAIL_PROVIDER=gmail

# Définir l'utilisateur Gmail
railway variables --set GMAIL_USER=ben.cohen.solal@gmail.com

# Créer la variable pour le mot de passe (vide, à remplir manuellement)
railway variables --set GMAIL_APP_PASSWORD=CHANGEME_WITH_YOUR_16_CHAR_APP_PASSWORD

# Définir l'adresse d'envoi
railway variables --set EMAIL_FROM="Senior Hub <ben.cohen.solal@gmail.com>"

echo "✅ Variables configurées!"
echo ""
echo "⚠️  ATTENTION: Vous devez maintenant:"
echo "1. Aller sur https://myaccount.google.com/apppasswords"
echo "2. Créer un mot de passe d'application pour 'Mail'"
echo "3. Exécuter: railway variables --set GMAIL_APP_PASSWORD=votre-mot-de-passe-16-caracteres"
echo "4. Le service va redémarrer automatiquement"
echo ""
echo "📖 Guide complet: docs/GMAIL_SMTP_SETUP.md"
