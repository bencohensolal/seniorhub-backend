# 🚨 Railway SMTP Bloqué - Solution

## Problème identifié

Les logs Railway montrent :
```
[Email] Using Gmail SMTP provider
[GmailSmtpProvider] SMTP connection failed: Connection timeout
[GmailSmtpProvider] Failed to send email: {
  to: 'boketof@gmail.com',
  error: 'connect ENETUNREACH 2607:f8b0:4023:c06::6d:465'
}
```

**Cause** : Railway bloque ou ne peut pas établir de connexions SMTP sortantes vers Gmail (port 465).

## ⚠️ Gmail SMTP ne fonctionne pas sur Railway

Les ports SMTP (465, 587) sont souvent bloqués sur les plateformes cloud pour éviter le spam.

## ✅ Solution : Utiliser Resend (API HTTP)

Resend utilise une **API HTTP** au lieu de SMTP → Non bloqué par Railway.

### Étapes (5 minutes)

#### 1. Créer un compte Resend

- Aller sur https://resend.com/signup
- Créer un compte gratuit
- Gratuit : 100 emails/jour, 3000/mois

#### 2. Obtenir l'API key

- Dashboard Resend → "API Keys"
- Cliquer "Create API Key"
- Copier la clé (commence par `re_`)

#### 3. Modifier les variables Railway

Sur Railway.app → Votre projet → Variables :

**REMPLACER** :
```env
EMAIL_PROVIDER=gmail
GMAIL_USER=ben.cohen.solal@gmail.com
GMAIL_APP_PASSWORD=...
EMAIL_FROM=Senior Hub <ben.cohen.solal@gmail.com>
```

**PAR** :
```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_votre_clé_api_ici
EMAIL_FROM=onboarding@resend.dev
```

**Note** : `onboarding@resend.dev` est un email de test fourni par Resend, utilisable immédiatement.

#### 4. Supprimer les anciennes variables

Sur Railway, **supprimer** :
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`

Garder seulement :
- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY=re_...`
- `EMAIL_FROM=onboarding@resend.dev`

#### 5. Railway redéploie automatiquement

- Railway détecte le changement de variables
- Redéploiement automatique (~1-2 minutes)
- Attendre que le déploiement soit terminé

#### 6. Vérifier les logs Railway

Au démarrage, vous devriez voir :
```
[Email] Using Resend email provider
```

Lors de l'envoi :
```
[Invitations] Resending invitation email: { ... }
[ResendEmailProvider] Email sent successfully to boketof@gmail.com (ID: xxx)
```

#### 7. Tester

- Renvoyer une invitation
- L'email devrait arriver dans quelques secondes
- Vérifier le spam si nécessaire

## 📊 Comparaison

| Provider | Protocole | Fonctionne sur Railway ? | Gratuit |
|----------|-----------|-------------------------|---------|
| Gmail SMTP | SMTP (port 465) | ❌ Bloqué | ✅ 500/jour |
| Resend | HTTP API | ✅ Oui | ✅ 100/jour, 3000/mois |

## 🎯 Pour aller plus loin (optionnel)

### Utiliser votre propre domaine avec Resend

Actuellement : `onboarding@resend.dev` (email de test)

Pour utiliser votre domaine (ex: `noreply@seniorhub.app`) :

1. **Sur Resend** :
   - Dashboard → "Domains"
   - Ajouter votre domaine
   - Suivre les instructions DNS (ajouter SPF, DKIM records)

2. **Vérification** :
   - Attendre que les DNS se propagent (~24h max)
   - Resend vérifie automatiquement

3. **Mise à jour Railway** :
   ```env
   EMAIL_FROM=Senior Hub <noreply@seniorhub.app>
   ```

### Avantages domaine vérifié :
- ✅ Meilleure délivrabilité (moins de spam)
- ✅ Email professionnel
- ✅ Statistiques d'envoi dans Resend
- ✅ Webhooks pour tracking

## 🐛 Si ça ne marche toujours pas

### 1. Vérifier l'API key Resend

```bash
# Tester manuellement l'API key
curl https://api.resend.com/emails \
  -H "Authorization: Bearer re_VOTRE_CLE" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "onboarding@resend.dev",
    "to": "boketof@gmail.com",
    "subject": "Test",
    "html": "<p>Test email</p>"
  }'
```

Si succès → API key valide
Si erreur → Régénérer l'API key

### 2. Vérifier les logs Railway

Chercher des erreurs comme :
```
[ResendEmailProvider] Error sending email: Invalid API key
```

### 3. Vérifier le spam

- Les emails Resend peuvent aller dans le spam initialement
- Marquer comme "Non spam" pour améliorer la réputation

## 📚 Documentation

- Resend Quickstart : https://resend.com/docs/send-with-nodejs
- Resend Dashboard : https://resend.com/emails
- Guide complet : `docs/RESEND_SETUP.md`

## ✅ Checklist finale

- [ ] Compte Resend créé
- [ ] API key obtenue
- [ ] Variables Railway mises à jour (`EMAIL_PROVIDER=resend`, `RESEND_API_KEY=...`)
- [ ] Anciennes variables Gmail supprimées
- [ ] Redéploiement Railway terminé
- [ ] Logs montrent `[Email] Using Resend email provider`
- [ ] Test d'envoi effectué
- [ ] Email reçu sur boketof@gmail.com

---

**Temps estimé** : 5-10 minutes
**Coût** : Gratuit (100 emails/jour)
**Difficulté** : ⭐ Facile
