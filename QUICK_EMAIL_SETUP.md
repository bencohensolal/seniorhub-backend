# 🚀 Configuration rapide de l'envoi d'emails

## ⚠️ PROBLÈME ACTUEL

Votre configuration :
```
EMAIL_PROVIDER=console
```

**Résultat** : Les emails sont affichés dans les logs mais **jamais envoyés** réellement.

## ✅ SOLUTION IMMÉDIATE

### Option 1 : Resend (Recommandé - Gratuit pour démarrer)

**Étapes rapides (5 minutes) :**

1. **Créer un compte gratuit** : https://resend.com/signup
   - Gratuit : 100 emails/jour, 3000/mois

2. **Obtenir votre API key** :
   - Aller dans le dashboard Resend
   - Section "API Keys"
   - Créer une nouvelle clé
   - Copier la clé (commence par `re_`)

3. **Modifier votre `.env`** :
   ```env
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_votre_clé_copiée_ici
   EMAIL_FROM=Senior Hub <noreply@seniorhub.app>
   ```

4. **Pour les TESTS (utiliser l'email de test Resend)** :
   ```env
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_votre_clé_copiée_ici
   EMAIL_FROM=onboarding@resend.dev
   ```
   ⚠️ `onboarding@resend.dev` fonctionne tout de suite, pas besoin de vérifier un domaine

5. **Redémarrer le serveur** :
   ```bash
   # Arrêter le serveur (Ctrl+C)
   npm start
   ```

6. **Tester** :
   - Renvoyer une invitation
   - Vérifier les logs : vous devriez voir `[ResendEmailProvider] Email sent successfully`

### Option 2 : Gmail SMTP (Alternative gratuite)

**Si vous préférez utiliser Gmail :**

1. **Activer l'authentification 2 facteurs** sur votre compte Gmail

2. **Générer un App Password** :
   - Aller sur : https://myaccount.google.com/apppasswords
   - Sélectionner "Mail" comme application
   - Copier le mot de passe généré (16 caractères)

3. **Modifier votre `.env`** :
   ```env
   EMAIL_PROVIDER=gmail
   GMAIL_USER=votre.email@gmail.com
   GMAIL_APP_PASSWORD=votre_mot_de_passe_app_16_caractères
   EMAIL_FROM=Senior Hub <votre.email@gmail.com>
   ```

4. **Redémarrer le serveur**

## 📋 Vérification

Après avoir configuré un provider réel, vous devriez voir dans les logs :

**Au démarrage :**
```
[Email] Using Resend email provider
```
ou
```
[Email] Using Gmail SMTP provider
[GmailSmtpProvider] SMTP connection verified successfully
```

**Lors de l'envoi :**
```
[Invitations] Enqueuing bulk emails: { count: 1, recipients: ['email@example.com'] }
[ResendEmailProvider] Email sent successfully to email@example.com (ID: xxx)
```

## 🐛 Si ça ne marche toujours pas

1. **Vérifier les logs du serveur** pour voir les erreurs exactes
2. **Consulter** `docs/EMAIL_TROUBLESHOOTING.md` pour le diagnostic complet
3. **Vérifier le dossier spam** du destinataire

## ⚡ Test rapide avec Resend

Le plus rapide pour tester MAINTENANT :

```bash
# 1. Créer compte sur https://resend.com
# 2. Obtenir API key
# 3. Éditer .env :

EMAIL_PROVIDER=resend
RESEND_API_KEY=re_VOTRE_CLE_ICI
EMAIL_FROM=onboarding@resend.dev

# 4. Redémarrer le serveur
# 5. Renvoyer une invitation
# 6. Vérifier votre boîte mail !
```

---

**Note** : Le fichier `.env` ne doit PAS être commité dans git (il est dans `.gitignore`). Chaque environnement (dev, production) a son propre `.env`.
