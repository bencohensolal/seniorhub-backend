# Configuration Gmail SMTP sur Railway

## Étape 1: Linker le projet Railway

```bash
cd /Users/benjamincohensolal/workspaces/seniorhub/backend
railway link
```

Sélectionnez:
1. Workspace: `bencohensolal's Projects`
2. Project: `Senior Hub`
3. Environment: `production`
4. Service: `seniorhub-backend` (ou le nom de votre service API)

## Étape 2: Configurer les variables d'environnement

```bash
# Définir le provider email
railway variables --set EMAIL_PROVIDER=gmail

# Définir l'utilisateur Gmail
railway variables --set GMAIL_USER=ben.cohen.solal@gmail.com

# Définir l'adresse d'envoi
railway variables --set "EMAIL_FROM=Senior Hub <ben.cohen.solal@gmail.com>"

# Créer la variable pour le mot de passe (placeholder)
railway variables --set GMAIL_APP_PASSWORD=CHANGEME
```

## Étape 3: Créer un mot de passe d'application Gmail

1. Aller sur: https://myaccount.google.com/apppasswords
2. Vous devez avoir la 2FA activée (si ce n'est pas le cas, activez-la d'abord)
3. Cliquer sur "Créer" ou "Generate"
4. Sélectionner:
   - App: **Mail**
   - Device: **Other (Custom name)**
   - Nom: **Senior Hub Backend**
5. Cliquer sur **Generate**
6. **Copier le mot de passe de 16 caractères** (exemple: `abcd efgh ijkl mnop`)
7. **IMPORTANT**: Enlevez les espaces du mot de passe

## Étape 4: Mettre à jour le mot de passe dans Railway

```bash
# Remplacez les X par votre mot de passe (sans espaces)
railway variables --set GMAIL_APP_PASSWORD=abcdefghijklmnop
```

## Étape 5: Vérifier la configuration

```bash
# Voir toutes les variables
railway variables

# Le service va redémarrer automatiquement
# Vérifiez les logs pour voir la confirmation
railway logs
```

Vous devriez voir dans les logs:
```
[Email] Using Gmail SMTP provider
[GmailSmtpProvider] SMTP connection verified successfully
```

## Étape 6: Tester l'envoi d'email

Créez un foyer et invitez quelqu'un depuis l'app mobile. L'email devrait être envoyé!

## En cas de problème

### Erreur "Invalid login"
- Vérifiez que la 2FA est activée sur votre compte Google
- Régénérez un nouveau mot de passe d'application
- Assurez-vous d'avoir enlevé tous les espaces

### Erreur "SMTP connection failed"
- Vérifiez que `GMAIL_USER` contient bien votre email complet
- Vérifiez que `GMAIL_APP_PASSWORD` n'a pas d'espaces
- Vérifiez les logs Railway: `railway logs`

### Les emails ne sont pas envoyés
- Vérifiez que `EMAIL_PROVIDER=gmail` (pas `console` ou `resend`)
- Vérifiez les logs Railway pour voir les erreurs
- Testez la connexion: Les logs doivent montrer "SMTP connection verified successfully"

## Guide complet

Voir: `docs/GMAIL_SMTP_SETUP.md` pour plus de détails
