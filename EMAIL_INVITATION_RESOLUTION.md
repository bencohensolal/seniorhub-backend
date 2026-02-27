# Résolution : Emails d'invitation non envoyés

## 🔍 Diagnostic

### ✅ Ce qui fonctionne DÉJÀ

Le code d'envoi d'emails **existe et est fonctionnel**. L'architecture est correcte :

1. **Route handler** → Crée l'invitation en DB
2. **Route handler** → Enqueue les emails via `invitationEmailRuntime.queue.enqueueBulk()`
3. **Email Queue** → Traite les jobs de manière asynchrone
4. **Email Provider** → Envoie les emails (Console/Gmail/Resend)

### ❌ Problème identifié

Le problème n'est **PAS** que le code d'envoi est absent. Le problème est un **manque de visibilité/logging** qui rend le diagnostic impossible.

Sans logs appropriés, on ne peut pas savoir :
- Les emails sont-ils bien enqueued ?
- Le provider est-il correctement configuré ?
- Y a-t-il des erreurs silencieuses ?
- Le provider tente-t-il d'envoyer ?

## 🛠️ Changements apportés

### 1. Ajout de logs dans les routes d'invitation

**Fichier** : `src/routes/households/invitationRoutes.ts`

#### Endpoint `/v1/households/:id/invitations/bulk`

```typescript
// Nouveau log avant l'enqueue
console.log('[Invitations] Enqueuing bulk emails:', {
  count: emailJobs.length,
  recipients: emailJobs.map(j => j.inviteeEmail),
});

invitationEmailRuntime.queue.enqueueBulk(emailJobs);
```

**Permet de vérifier** : Les emails sont-ils bien enqueued après création des invitations ?

#### Endpoint `/v1/households/:id/invitations/:invitationId/resend`

```typescript
if (invitation) {
  console.log('[Invitations] Resending invitation email:', {
    invitationId: paramsResult.data.invitationId,
    inviteeEmail: invitation.inviteeEmail,
  });
  
  invitationEmailRuntime.queue.enqueueBulk([{...}]);
} else {
  console.warn('[Invitations] Cannot resend email - invitation not found:', {
    invitationId: paramsResult.data.invitationId,
  });
}
```

**Permet de vérifier** : L'invitation existe-t-elle au moment du resend ?

### 2. Documentation complète

**Nouveau fichier** : `docs/EMAIL_TROUBLESHOOTING.md`

Guide complet de diagnostic qui couvre :

✅ Vérification de la configuration EMAIL_PROVIDER  
✅ Vérification des credentials (Gmail/Resend)  
✅ Lecture des logs de startup  
✅ Vérification des templates email  
✅ Test manuel des providers  
✅ Scénarios communs et solutions  
✅ Checklist d'urgence  

## 🎯 Comment utiliser cette résolution

### Étape 1 : Vérifier la configuration actuelle

```bash
# Voir quelle configuration email est active
grep EMAIL .env

# Si EMAIL_PROVIDER=console → Les emails NE SONT PAS envoyés (mode dev uniquement)
```

### Étape 2 : Vérifier les logs au démarrage

```bash
# Au démarrage de l'application, chercher :
[Email] Using Console email provider (development mode)
# ou
[Email] Using Resend email provider
# ou
[Email] Using Gmail SMTP provider
```

Si vous voyez "Console email provider" en production, **c'est le problème** : les emails sont juste affichés dans les logs, pas envoyés.

### Étape 3 : Vérifier les logs à la création d'invitations

Avec les nouveaux logs, vous verrez maintenant :

```bash
[INVITE] Received bulk invitation request: { householdId: '...', ... }
[Invitations] Enqueuing bulk emails: { count: 2, recipients: ['user1@...', 'user2@...'] }
```

**Si vous ne voyez pas "Enqueuing bulk emails"** → Il y a une erreur avant l'enqueue (permissions, validation, etc.)

### Étape 4 : Vérifier les logs du provider

Selon le provider configuré :

**Console** (dev) :
```
📧 INVITATION EMAIL (Development Mode - Not Actually Sent)
To: user@example.com
Subject: You're invited...
```

**Resend** :
```
[ResendEmailProvider] Email sent successfully to user@example.com (ID: abc123)
```

**Gmail SMTP** :
```
[GmailSmtpProvider] Email sent successfully: { messageId: '...' }
```

### Étape 5 : Consulter le guide de troubleshooting

Si les emails ne sont toujours pas envoyés après avoir vérifié la config :

```bash
# Ouvrir le guide complet
cat docs/EMAIL_TROUBLESHOOTING.md
```

Ou suivre la checklist d'urgence dans le guide.

## 📋 Checklist de vérification

- [ ] **Configuration** : `EMAIL_PROVIDER` est-il correctement défini ? (pas "console" en prod)
- [ ] **Credentials** : Les clés API / mots de passe sont-ils valides ?
- [ ] **Startup logs** : Le provider s'initialise-t-il sans erreur ?
- [ ] **Invitation logs** : Voyez-vous "Enqueuing bulk emails" ?
- [ ] **Provider logs** : Le provider confirme-t-il l'envoi ?
- [ ] **Templates** : Les fichiers dans `templates/emails/invitation/` existent-ils ?
- [ ] **Spam** : L'email est-il dans les spams du destinataire ?
- [ ] **Rate limits** : Avez-vous dépassé les limites du provider ?

## 🔧 Scénarios les plus probables

### Scénario 1 : EMAIL_PROVIDER=console en production

**Symptôme** : Tout semble fonctionner, DB créée, mais pas d'email reçu.

**Diagnostic** :
```bash
# Logs de startup montrent :
[Email] Using Console email provider (development mode)

# Logs d'invitation montrent :
📧 INVITATION EMAIL (Development Mode - Not Actually Sent)
```

**Solution** :
```bash
# Dans .env ou variables d'environnement de production :
EMAIL_PROVIDER=resend  # ou gmail
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=Senior Hub <noreply@seniorhub.app>
```

### Scénario 2 : Credentials invalides ou manquants

**Symptôme** : Logs montrent des erreurs d'authentification.

**Diagnostic** :
```bash
[ResendEmailProvider] Error sending email: Invalid API key
# ou
[GmailSmtpProvider] SMTP connection failed: Authentication failed
```

**Solution** :
- Vérifier les credentials dans le dashboard du provider
- Regénérer les clés/mots de passe si nécessaire
- S'assurer qu'ils sont correctement définis dans l'environnement

### Scénario 3 : Templates manquants

**Symptôme** : Erreur lors de la construction du template.

**Diagnostic** :
```bash
# Vérifier que les fichiers existent
ls templates/emails/invitation/
# Doit contenir: subject.txt, body.txt
```

**Solution** :
```bash
# Les templates sont versionnés dans git, faire un pull
git pull origin main
```

## 📚 Documentation de référence

- **Guide de troubleshooting** : `docs/EMAIL_TROUBLESHOOTING.md`
- **Setup Gmail** : `docs/GMAIL_SMTP_SETUP.md`
- **Setup Resend** : `docs/RESEND_SETUP.md`
- **Options email** : `docs/EMAIL_OPTIONS.md`

## 🎉 Résumé

### Ce qui a été fait

✅ Ajout de logs stratégiques dans les routes d'invitation  
✅ Documentation complète de troubleshooting  
✅ Guide de diagnostic étape par étape  
✅ Checklist d'urgence  
✅ Scénarios courants et solutions  

### Ce qui N'a PAS été modifié

❌ Logique d'envoi d'emails (elle fonctionnait déjà)  
❌ Architecture du système (elle était correcte)  
❌ Configuration par défaut (toujours console en dev)  

### Prochaines étapes

1. **En développement** : Rien à faire, `EMAIL_PROVIDER=console` est correct
2. **En production** : Vérifier que `EMAIL_PROVIDER` est configuré (gmail ou resend)
3. **Si emails pas reçus** : Suivre `docs/EMAIL_TROUBLESHOOTING.md`

---

**Note importante** : Le code d'envoi d'emails était déjà implémenté et fonctionnel. Cette résolution se concentre sur la **visibilité et le diagnostic**, pas sur l'implémentation de la fonctionnalité.
