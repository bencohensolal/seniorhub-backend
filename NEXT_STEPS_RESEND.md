# 🎯 Prochaines étapes pour activer l'envoi d'emails

## ✅ Configuration Railway complétée

Les variables suivantes ont été configurées sur Railway :

```
EMAIL_PROVIDER = resend
EMAIL_FROM = Senior Hub <onboarding@resend.dev>
RESEND_API_KEY = YOUR_RESEND_API_KEY_HERE  ⚠️ À remplacer !
```

## 📋 Ce qu'il vous reste à faire

### Étape 1 : Créer un compte Resend (5 minutes)

1. Aller sur **https://resend.com**
2. Cliquer sur "Sign Up" (inscription gratuite)
3. Vérifier votre email

### Étape 2 : Obtenir votre clé API (2 minutes)

1. Une fois connecté, aller sur **https://resend.com/api-keys**
2. Cliquer sur "Create API Key"
3. Donner un nom : `Senior Hub Production`
4. Copier la clé (commence par `re_`)
5. **Important :** La sauvegarder immédiatement (vous ne pourrez plus la revoir)

### Étape 3 : Mettre à jour la variable Railway (1 minute)

Remplacer le placeholder par votre vraie clé API :

```bash
railway variables set RESEND_API_KEY=re_votre_vraie_cle_ici
```

Ou via le dashboard Railway :
1. Aller sur https://railway.app
2. Sélectionner votre projet "Senior Hub"
3. Onglet "Variables"
4. Modifier `RESEND_API_KEY` avec votre vraie clé

### Étape 4 : Redéployer (automatique)

Railway redéploiera automatiquement après le changement de variable.

Vous pouvez vérifier dans les logs :
```
[Email] Using Resend email provider
```

### Étape 5 : Tester ! 🎉

1. Créer un foyer dans l'app
2. Inviter quelqu'un avec un vrai email
3. Vérifier que l'email est bien reçu
4. Vérifier dans le dashboard Resend : https://resend.com/emails

## 📊 Limites du free tier Resend

**Ce qui est inclus gratuitement :**
- ✅ 100 emails/jour
- ✅ 3,000 emails/mois
- ✅ Pas de carte de crédit requise

**Estimation pour Senior Hub :**
- 1 foyer créé = ~5 invitations
- 100 foyers/mois = 500 emails
- **Vous êtes largement dans le free tier !**

## 🔍 Monitoring

### Vérifier que les emails sont envoyés

1. **Dashboard Resend** : https://resend.com/emails
   - Voir tous les emails envoyés
   - Statut de délivrance
   - Statistiques

2. **API Metrics** : `GET /v1/observability/invitations/email-metrics`
   - Nombre d'emails en queue
   - Succès vs échecs
   - Statistiques de retry

3. **Logs Railway**
   - Messages de confirmation : `[ResendEmailProvider] Email sent successfully`
   - Erreurs éventuelles

## ⚠️ Utilisation du domaine de test

Actuellement configuré avec : `onboarding@resend.dev`

**Ce domaine de test :**
- ✅ Fonctionne immédiatement sans configuration
- ✅ Parfait pour le développement et les tests
- ⚠️ Ajoute un bandeau dans l'email mentionnant que c'est un test

**Pour la production (plus tard) :**
Vous devrez configurer votre propre domaine (ex: `noreply@seniorhub.app`) :
1. Ajouter votre domaine dans Resend
2. Configurer les DNS records (SPF, DKIM)
3. Attendre la vérification
4. Changer `EMAIL_FROM` dans Railway

Mais **pour l'instant, `onboarding@resend.dev` est parfait** pour tester !

## 🚨 En cas de problème

### L'API ne démarre pas

**Vérifier les logs Railway :**
```bash
railway logs
```

**Erreurs possibles :**
- `RESEND_API_KEY is required` : La clé n'est pas définie
- `Failed to send email via Resend` : Problème avec la clé API

### Les emails ne sont pas envoyés

1. Vérifier que `RESEND_API_KEY` est bien valorisée (pas le placeholder)
2. Vérifier dans les logs : `[Email] Using Resend email provider`
3. Regarder le dashboard Resend pour voir les erreurs
4. Vérifier les limites du free tier (100/jour, 3000/mois)

### Besoin d'aide

- Documentation Resend : https://resend.com/docs
- Guide détaillé : `api/docs/RESEND_SETUP.md`
- Options alternatives : `api/docs/EMAIL_OPTIONS.md`

## ✨ C'est prêt !

Une fois `RESEND_API_KEY` valorisée, vos invitations enverront automatiquement de vrais emails !

**Temps total estimé : 10 minutes** ⏱️
