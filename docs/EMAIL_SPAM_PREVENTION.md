# 📧 Prévention des emails dans les spams

## Pourquoi les emails vont dans les spams ?

### Facteurs identifiés pour Senior Hub

#### 1. **Utilisation d'onboarding@resend.dev (email de test)**
- ❌ Domaine `resend.dev` n'est PAS votre domaine
- ❌ Partagé par tous les utilisateurs de Resend en test
- ❌ Réputation variable selon les autres utilisateurs
- ✅ **Solution** : Utiliser votre propre domaine vérifié

#### 2. **Absence de SPF, DKIM, DMARC**
- ❌ Sans domaine vérifié, pas d'authentification email
- ❌ Les serveurs de réception ne peuvent pas vérifier l'expéditeur
- ✅ **Solution** : Configurer un domaine avec records DNS

#### 3. **Nouveau domaine/expéditeur**
- ❌ Premier envoi depuis cet expéditeur = suspect
- ❌ Pas d'historique de réputation
- ✅ **Solution** : Temps (réputation se construit progressivement)

#### 4. **Contenu potentiellement suspect**
- ⚠️ Liens dans l'email (deep links, fallback URLs)
- ⚠️ Mots comme "invitation", "cliquer", "accepter"
- ✅ **Solution** : Template HTML professionnel (✅ fait)

## ✅ Solutions implémentées

### 1. Template HTML professionnel
- ✅ Design cohérent et moderne
- ✅ Structure HTML valide avec balises sémantiques
- ✅ Responsive (mobile-friendly)
- ✅ Logo et branding clair
- ✅ Badge de sécurité
- ✅ Footer avec informations légales

### 2. Meilleur sujet d'email
- **Avant** : `Senior Hub household invitation`
- **Après** : `🏡 Vous êtes invité(e) à rejoindre un foyer sur Senior Hub`
- ✅ En français (langue naturelle de l'utilisateur)
- ✅ Emoji pour humaniser
- ✅ Clair et descriptif

## 🚀 Solutions à implémenter

### Solution 1 : Domaine vérifié avec Resend (Recommandé)

#### Étapes

**1. Acheter/Configurer un domaine**
- Domaine : `seniorhub.app` (ou `seniorhub.fr`, `seniorhub.com`)
- Coût : ~10-15€/an

**2. Ajouter le domaine sur Resend**
```
Dashboard Resend → Domains → Add Domain
Domaine : seniorhub.app
```

**3. Configurer les DNS**

Resend fournira ces records à ajouter chez votre registrar (OVH, Gandi, etc.) :

```dns
# SPF (Sender Policy Framework)
Type: TXT
Name: seniorhub.app
Value: v=spf1 include:_spf.resend.com ~all

# DKIM (DomainKeys Identified Mail)
Type: TXT  
Name: resend._domainkey.seniorhub.app
Value: [fourni par Resend]

# DMARC (Domain-based Message Authentication)
Type: TXT
Name: _dmarc.seniorhub.app
Value: v=DMARC1; p=none; rua=mailto:dmarc@seniorhub.app
```

**4. Attendre la vérification** (~15 min à 24h)

**5. Mettre à jour EMAIL_FROM**
```env
EMAIL_FROM=Senior Hub <noreply@seniorhub.app>
```

#### Avantages
- ✅ Meilleure délivrabilité (90%+ dans inbox)
- ✅ Authentification complète (SPF + DKIM + DMARC)
- ✅ Email professionnel
- ✅ Dashboard Resend pour tracking
- ✅ Webhooks pour événements (ouvert, cliqué, bounced)

### Solution 2 : Domaine de sous-domaine

Si vous avez déjà un domaine principal (ex: `votre-site.com`), créez un sous-domaine :

```
noreply@mail.votre-site.com
```

Avantages :
- Séparation email transactionnel / marketing
- Protection du domaine principal

## 📊 Checklist anti-spam complète

### Côté serveur
- [x] Template HTML professionnel avec structure valide
- [x] Sujet clair et descriptif
- [x] Footer avec informations légales
- [x] Lien de désabonnement explicite (dans le footer)
- [ ] Domaine vérifié (SPF + DKIM + DMARC)
- [ ] Email FROM personnalisé (@seniorhub.app)
- [ ] Headers email appropriés

### Côté contenu
- [x] Ratio texte/images équilibré
- [x] Pas de mots SPAM excessifs (GRATUIT, CLIQUEZ ICI, etc.)
- [x] Lien avec context clair
- [x] Message de sécurité pour utilisateurs non concernés
- [x] Langue appropriée (français)

### Côté réputation
- [ ] Commencer avec petit volume
- [ ] Monitorer les bounces et plaintes
- [ ] Répondre rapidement aux problèmes
- [ ] Warm-up progressif (augmenter volume graduellement)

## 🎯 Plan d'action immédiat

### Phase 1 : Court terme (sans domaine)

**Déjà fait** :
- ✅ Template HTML moderne
- ✅ Meilleur sujet
- ✅ Structure professionnelle

**À faire** :
1. Demander aux destinataires de :
   - Marquer l'email comme "Non spam"
   - Ajouter `noreply@seniorhub.app` aux contacts
2. Tester avec plusieurs providers (Gmail, Outlook, Yahoo)

### Phase 2 : Moyen terme (domaine vérifié)

1. **Acheter domaine** : `seniorhub.app` ou `seniorhub.fr`
2. **Configurer DNS** sur Resend
3. **Tester** avec le nouveau domaine
4. **Monitorer** les taux de délivrabilité

### Phase 3 : Long terme (optimisation)

1. **Monitoring** :
   - Dashboard Resend : taux d'ouverture, bounces
   - Webhooks pour tracking détaillé
   
2. **A/B Testing** :
   - Tester différents sujets
   - Tester différents contenus
   
3. **Segmentation** :
   - Différents templates selon le rôle
   - Personnalisation accrue

## 🔍 Tester la délivrabilité

### Outil : Mail-Tester

```bash
# 1. Obtenir une adresse de test
# Aller sur https://www.mail-tester.com
# Noter l'adresse email temporaire

# 2. Envoyer une invitation de test à cette adresse

# 3. Cliquer sur "Then check your score"

# Score:
# 10/10 = Parfait
# 7-9/10 = Bon (quelques améliorations possibles)
# <7/10 = Risque élevé de spam
```

### Points vérifiés par Mail-Tester
- SPF, DKIM, DMARC
- Contenu HTML valide
- Ratio texte/liens
- Blacklists
- Headers email

## 📈 Statistiques attendues

### Avec onboarding@resend.dev (actuel)
- Inbox : ~50-60%
- Spam : ~40-50%
- Raison : Domaine partagé, pas de réputation

### Avec domaine vérifié (recommandé)
- Inbox : ~90-95%
- Spam : ~5-10%
- Raison : Authentification complète, domaine dédié

### Premier envoi vs. emails réguliers
- Premier envoi : Plus susceptible d'aller en spam
- Après quelques envois : Réputation se construit
- Après utilisateurs marquent "Non spam" : Score améliore

## 🛠️ Debug spam

### Si email toujours en spam après domaine vérifié

**1. Vérifier les headers**
```bash
# Dans Gmail :
# Ouvrir l'email → ⋮ (menu) → "Afficher l'original"

# Chercher :
# - SPF: PASS
# - DKIM: PASS  
# - DMARC: PASS
```

**2. Vérifier les blacklists**
- https://mxtoolbox.com/blacklists.aspx
- Entrer votre domaine ou IP

**3. Warm-up progressif**
```
Jour 1: 10 emails
Jour 2: 20 emails
Jour 3: 50 emails
Jour 7: 100 emails
Jour 14: Volume normal
```

## 📚 Ressources

- [Resend Domain Setup](https://resend.com/docs/dashboard/domains/introduction)
- [Email Authentication Best Practices](https://resend.com/docs/send-with-resend/spf-dkim-dmarc)
- [Mail-Tester](https://www.mail-tester.com)
- [MX Toolbox](https://mxtoolbox.com)

## ✅ Résumé

| Mesure | Statut | Impact sur spam |
|--------|--------|-----------------|
| Template HTML professionnel | ✅ Fait | Moyen (+10-15%) |
| Sujet amélioré | ✅ Fait | Faible (+5%) |
| Domaine vérifié | ⏳ À faire | Fort (+40-50%) |
| SPF/DKIM/DMARC | ⏳ À faire | Fort (+30-40%) |
| Réputation domaine | ⏳ Temps | Moyen (+10-20%) |

**Prochaine étape critique** : Configurer un domaine vérifié avec Resend.
