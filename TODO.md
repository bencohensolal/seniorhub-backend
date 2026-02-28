# TODO Backend

## 🔍 URGENT: Debug Invitation Acceptance Flow

### Logs ajoutés dans PostgresHouseholdRepository.acceptInvitation()

Des logs détaillés ont été ajoutés pour debugger pourquoi les utilisateurs invités ne deviennent pas membres:

**Logs ajoutés:**
- ✅ Requester info (userId, email, firstName, lastName)
- ✅ Token validation
- ✅ Email normalization
- ✅ Transaction start
- ✅ Invitation found (id, householdId, email, role, status, expires)
- ✅ Email match validation
- ✅ Status validation (pending)
- ✅ Expiration check
- ✅ Invitation update (status = accepted)
- ✅ Member creation (INSERT with ON CONFLICT)
- ✅ Member insertion result (rowCount, member data)
- ✅ Transaction commit
- ✅ All errors logged

**Ce que les logs vont montrer:**
1. Si l'appel arrive au backend (si pas de logs → app n'appelle pas)
2. Si le token est valide
3. Si l'invitation est trouvée
4. Si l'email correspond
5. Si le membre est bien inséré dans la DB
6. Si la transaction est bien commitée

**Prochaines étapes:**
1. Déployer backend avec logs
2. Tester avec app mobile (mec95200@gmail.com)
3. Regarder logs Railway pour diagnostic
4. Si appel n'arrive pas → problème dans l'app
5. Si appel arrive mais pas de membre → problème SQL/transaction

---

## Endpoints Disponibles

### POST /v1/households/invitations/accept

**URL:** `https://seniorhub-backend-production.up.railway.app/v1/households/invitations/accept`

**Method:** POST

**Headers (Required):**
```
x-user-id: <supabase_user_id>
x-user-email: <user_email>
x-user-first-name: <first_name>
x-user-last-name: <last_name>
Content-Type: application/json
```

**Body:**
```json
{
  "token": "22db9a60-6852-4b6c-a5a9-49d216f5b89e..."
}
```

**Response Success (200):**
```json
{
  "status": "success",
  "data": {
    "householdId": "3617e173-d359-492b-94b7-4c32622e7526",
    "role": "caregiver"
  }
}
```

**Ce que fait cet endpoint:**
1. Valide le token
2. Trouve l'invitation correspondante
3. Vérifie que l'email du requester correspond à l'invitation
4. Met à jour l'invitation (status = 'accepted')
5. **CRÉE LE MEMBRE** dans household_members avec status = 'active'
6. Retourne householdId et role

**Note:** Le code crée bien le membre. Si le membre n'apparaît pas, c'est soit:
- L'appel n'arrive jamais au backend
- Une erreur se produit (logs montreront laquelle)
- La transaction est rollback (logs montreront pourquoi)

---

### GET /v1/invitations/accept-link (PUBLIC)

**URL:** `https://seniorhub-backend-production.up.railway.app/v1/invitations/accept-link?token=XXX`

**Ce que fait cet endpoint:**
1. Valide le token
2. Détecte si mobile (User-Agent)
3. Si mobile → redirige vers `seniorhub://invitation/accept?token=XXX`
4. Si web → redirige vers frontend web

**Important:** Ce endpoint fait la redirection vers l'app mobile. L'app doit ensuite:
1. Recevoir le deep link
2. Extraire le token
3. Stocker le token
4. Attendre que user s'authentifie
5. Appeler POST /v1/households/invitations/accept avec le token

---

## Autres endpoints en attente

_(liste des autres fonctionnalités à implémenter)_
