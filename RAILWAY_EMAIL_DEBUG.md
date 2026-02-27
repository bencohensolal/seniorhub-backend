# Debug Email sur Railway

## 🔍 Vérification de la configuration

Vous avez configuré Gmail sur Railway :
```env
EMAIL_PROVIDER="gmail"
GMAIL_USER="ben.cohen.solal@gmail.com"
GMAIL_APP_PASSWORD="..."
EMAIL_FROM="Senior Hub <ben.cohen.solal@gmail.com>"
```

Cette configuration est **correcte**, les emails devraient partir.

## 📋 Checklist de diagnostic

### 1. Vérifier que vous testez le bon serveur

Le serveur sur `http://10.143.93.24:8080` est-il :
- ❓ Votre serveur LOCAL (npm start sur votre machine) ?
- ❓ Le serveur RAILWAY (déployé) ?

**Important** : Si c'est votre serveur local, il utilise le fichier `.env` local (qui a `EMAIL_PROVIDER=console`), pas les variables de Railway !

### 2. Vérifier les logs de démarrage

#### Sur Railway (dashboard Railway → Logs) :
Cherchez au démarrage :
```
[Email] Using Gmail SMTP provider
[GmailSmtpProvider] SMTP connection verified successfully
```

✅ Si vous voyez ça → Gmail est bien configuré

❌ Si vous voyez :
```
[GmailSmtpProvider] SMTP connection failed: Invalid login
```
→ Le mot de passe App Gmail est invalide ou expiré

❌ Si vous voyez :
```
[Email] Using Console email provider
```
→ Les variables d'environnement ne sont pas chargées sur Railway

### 3. Vérifier les logs d'envoi

Après avoir envoyé une invitation, cherchez dans les logs Railway :

**Succès** :
```
[Invitations] Enqueuing bulk emails: { count: 1, recipients: ['boketof@gmail.com'] }
[GmailSmtpProvider] Email sent successfully: { messageId: '...', to: 'boketof@gmail.com' }
```

**Échec** :
```
[Invitations] Enqueuing bulk emails: { count: 1, recipients: ['boketof@gmail.com'] }
[GmailSmtpProvider] Failed to send email: { to: 'boketof@gmail.com', error: '...' }
```

### 4. Problèmes courants Gmail

#### A. Mot de passe App expiré ou invalide
**Symptôme** : `Authentication failed` ou `Invalid login`

**Solution** :
1. Aller sur https://myaccount.google.com/apppasswords
2. Révoquer l'ancien mot de passe
3. Créer un nouveau mot de passe App
4. Mettre à jour `GMAIL_APP_PASSWORD` sur Railway
5. Redéployer

#### B. Authentification 2 facteurs désactivée
**Symptôme** : `Less secure app access required`

**Solution** :
1. Activer l'authentification 2 facteurs sur votre compte Gmail
2. Créer un mot de passe App (nécessite 2FA)

#### C. Compte Gmail suspendu ou limité
**Symptôme** : `Account suspended` ou `Daily limit exceeded`

**Solution** :
- Vérifier le dashboard Gmail pour les alertes
- Gmail gratuit : limite de 500 emails/jour
- Attendre 24h si limite atteinte

#### D. Emails bloqués comme spam
**Symptôme** : Logs montrent "Email sent successfully" mais rien reçu

**Solution** :
1. Vérifier le dossier SPAM de boketof@gmail.com
2. Si trouvé dans spam → Problème de réputation du domaine gmail
3. Solution à long terme : utiliser Resend avec domaine vérifié

## 🚀 Actions immédiates

### Action 1 : Vérifier quel serveur vous testez

```bash
# Si vous testez en LOCAL, vérifiez votre .env local
cat .env | grep EMAIL_PROVIDER

# Si vous voyez "console" → C'est le problème
# Changez pour :
EMAIL_PROVIDER=gmail
GMAIL_USER=ben.cohen.solal@gmail.com
GMAIL_APP_PASSWORD=votre_mot_de_passe_app
EMAIL_FROM=Senior Hub <ben.cohen.solal@gmail.com>
```

### Action 2 : Consulter les logs Railway

1. Aller sur https://railway.app
2. Sélectionner votre projet seniorhub-backend
3. Onglet "Deployments" → dernier déploiement
4. Voir les logs complets
5. Chercher `[Email]` et `[GmailSmtpProvider]`

### Action 3 : Tester avec un nouveau App Password

1. https://myaccount.google.com/apppasswords
2. Créer nouveau mot de passe (16 caractères)
3. Copier exactement (sans espaces)
4. Sur Railway → Variables → `GMAIL_APP_PASSWORD`
5. Sauvegarder → Railway redéploie automatiquement
6. Attendre le redéploiement
7. Retester

## 📊 Logs attendus (Railway avec Gmail)

**Au démarrage** :
```
Server starting...
[Email] Using Gmail SMTP provider
[GmailSmtpProvider] SMTP connection verified successfully
Server listening at http://...
```

**Lors de l'envoi d'invitation** :
```
incoming request
[Invitations] Enqueuing bulk emails: { count: 1, recipients: ['boketof@gmail.com'] }
[GmailSmtpProvider] Email sent successfully: { messageId: 'xxx', to: 'boketof@gmail.com' }
request completed
```

## ⚠️ Si aucun log d'envoi n'apparaît

Si vous voyez :
```
[Invitations] Enqueuing bulk emails: { ... }
request completed
```

Mais AUCUN log de `[GmailSmtpProvider]` → L'email est dans la queue mais pas traité.

**Cause possible** : Erreur silencieuse dans le queue processing.

**Debug** : Ajouter temporairement des logs dans `InvitationEmailQueue.ts` pour voir l'erreur exacte.

## 🎯 Prochaines étapes

1. **Montrez-moi les logs de démarrage de votre serveur** (les 20 premières lignes)
2. **Montrez-moi les logs complets après l'envoi d'une invitation**
3. **Vérifiez le spam de boketof@gmail.com**

Avec ces infos, je pourrai identifier le problème exact !
