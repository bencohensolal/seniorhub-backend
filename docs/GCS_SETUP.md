# Configuration Google Cloud Storage pour Photo Screens

Guide pour utiliser Google Cloud Storage (GCS) - le service de stockage de fichiers pour Senior Hub.

## 💡 Pourquoi GCS ?

- ✅ **Déjà sur GCP** pour OAuth → une seule plateforme
- ✅ **Free Tier permanent** : 5GB stockage + 1GB network gratuit/mois
- ✅ **Plus simple** : un seul compte, une seule facturation
- ✅ **Moins cher** pour petits volumes
- ✅ **Solution unique** : Pas besoin de gérer plusieurs providers

## 💰 Coûts GCS

### Google Cloud Storage

**Free Tier (PERMANENT) :**
- 5GB stockage gratuit/mois
- 1GB egress gratuit/mois (vers Amérique du Nord)
- 5000 opérations Class A (write) gratuites/mois
- 50000 opérations Class B (read) gratuites/mois

**Tarifs après Free Tier (europe-west1) :**
- Stockage : $0.020/GB/mois
- Egress : $0.12/GB
- **Total estimé : ~$3-7/mois** pour usage modéré

**🎯 GCS est économique et simple !**

## 🚀 Configuration GCS (15 minutes)

### Étape 1 : Créer un Bucket GCS

1. Aller sur **Google Cloud Console** → **Cloud Storage** → **Buckets**
2. Cliquer **Create bucket**

Configuration :
```
Name: seniorhub-photos-production
Location type: Region
Location: europe-west1 (Belgique) ou europe-west9 (Paris)
Storage class: Standard
Access control: Uniform
Protection tools: None (ou activer versioning si besoin)
Encryption: Google-managed key
```

3. Cliquer **Create**

### Étape 2 : Rendre le bucket accessible publiquement

1. Aller dans votre bucket → **Permissions**
2. Cliquer **Grant access**
3. Ajouter :
   - **New principals**: `allUsers`
   - **Role**: `Storage Object Viewer`
4. **Allow public access**

> ⚠️ Alternative plus sécurisée : Utiliser des signed URLs (voir section avancée)

### Étape 3 : Activer CORS (optionnel)

Si upload direct depuis le frontend :

1. Dans le bucket → **Configuration** → **CORS**
2. Éditer et ajouter :

```json
[
  {
    "origin": ["https://votredomaine.com"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

### Étape 4 : Créer un Service Account

1. **IAM & Admin** → **Service Accounts** → **Create Service Account**

Configuration :
```
Service account name: seniorhub-storage
Service account ID: seniorhub-storage
Description: Service account for SeniorHub photo storage
```

2. Cliquer **Create and Continue**

3. Rôles à attribuer :
   - **Storage Object Admin** (pour upload/delete)
   - **Storage Object Viewer** (pour lire)

4. Cliquer **Continue** → **Done**

### Étape 5 : Générer une clé JSON

1. Dans la liste des Service Accounts → **Actions** (⋮) → **Manage keys**
2. **Add key** → **Create new key**
3. Type : **JSON**
4. Cliquer **Create**

⚠️ **Télécharger et sauvegarder le fichier JSON immédiatement** - il ne sera plus accessible !

### Étape 6 : Encoder la clé en base64 (pour Railway)

Pour faciliter le déploiement sur Railway, encoder la clé JSON en base64 :

```bash
# Sur macOS/Linux
cat service-account-key.json | base64

# Sur Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account-key.json"))
```

Copier la sortie (très longue) - c'est votre `GCP_SERVICE_ACCOUNT_KEY_BASE64`.

## ⚙️ Configuration Railway

### Variables d'environnement requises

Dans Railway → votre service → **Variables** :

```bash
# Google Cloud Storage
GCS_BUCKET_NAME=seniorhub-photos-production
GCS_PROJECT_ID=votre-project-id
GCS_CLIENT_EMAIL=votre-service-account@votre-project.iam.gserviceaccount.com
GCS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
GCP_SERVICE_ACCOUNT_KEY_BASE64=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50Iiwi... (très long)
```

### Alternative : Utiliser GCP_SERVICE_ACCOUNT_KEY_BASE64 uniquement

Si vous avez encodé la clé JSON en base64, vous pouvez utiliser uniquement :

```bash
GCP_SERVICE_ACCOUNT_KEY_BASE64=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50Iiwi...
```

Le système extraira automatiquement `GCS_PROJECT_ID`, `GCS_CLIENT_EMAIL` et `GCS_PRIVATE_KEY`.

## 🔧 Configuration backend

### 1. Mettre à jour env.ts

Le fichier `src/config/env.ts` contient déjà la configuration GCS :

```typescript
// Google Cloud Storage
GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || '',
GCS_PROJECT_ID: process.env.GCS_PROJECT_ID || '',
GCS_CLIENT_EMAIL: process.env.GCS_CLIENT_EMAIL || '',
GCS_PRIVATE_KEY: process.env.GCS_PRIVATE_KEY || '',
GCP_SERVICE_ACCOUNT_KEY_BASE64: process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64 || '',
```

### 2. Service de stockage

Le service de stockage utilise automatiquement GCS via `createStorageService()` :

```typescript
export function createStorageService(): StorageService {
  console.info('[Storage] Initializing GCS storage service:', {
    hasGcpServiceAccountKeyBase64: !!env.GCP_SERVICE_ACCOUNT_KEY_BASE64,
    hasGcsProjectId: !!env.GCS_PROJECT_ID,
    hasGcsBucketName: !!env.GCS_BUCKET_NAME,
    hasGcsClientEmail: !!env.GCS_CLIENT_EMAIL,
    hasGcsPrivateKey: !!env.GCS_PRIVATE_KEY,
  });

  return new GCSStorageService();
}
```

### 3. Utiliser le service dans les routes

Dans `src/routes/households/photoScreenRoutes.ts` :

```typescript
import { createStorageService } from '../../data/services/storage/createStorageService.js';

export async function photoScreenRoutes(server: FastifyInstance) {
  const repository = createHouseholdRepository();
  const storageService = createStorageService();

  // ... reste du code
}
```

## 🧪 Tester la configuration

### Test 1 : Vérifier les variables d'environnement

```bash
cd backend
npm run test:storage
```

### Test 2 : Téléverser une image test

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.jpg" \
  -F "tabletId=test-tablet" \
  -F "photoScreenId=test-screen" \
  https://votre-api.railway.app/v1/households/{householdId}/tablets/{tabletId}/photo-screens/{photoScreenId}/photos
```

### Test 3 : Vérifier l'URL générée

L'URL devrait ressembler à :
```
https://storage.googleapis.com/seniorhub-photos-production/households/{householdId}/tablets/{tabletId}/photos/{photoId}.jpg
```

Ouvrir cette URL dans un navigateur pour vérifier que l'image est accessible.

## 🔐 Configuration avancée : Signed URLs

Pour plus de sécurité, vous pouvez utiliser des signed URLs au lieu d'un accès public :

### 1. Désactiver l'accès public

Dans le bucket → **Permissions** → Retirer `allUsers`

### 2. Générer des signed URLs dans le code

Le `GCSStorageService` génère automatiquement des signed URLs pour les uploads :

```typescript
const { url } = await storageService.uploadPhoto({
  householdId: '...',
  tabletId: '...',
  photoId: '...',
  buffer: imageBuffer,
  mimeType: 'image/jpeg',
});
```

### 3. Configurer la durée de validité

Par défaut : 1 heure. Modifiable via `expiresInSeconds` :

```typescript
const signedUrl = await storageService.getSignedUrl(
  'households/.../photo.jpg',
  3600 // 1 heure
);
```

## 🐛 Dépannage

### Erreur : "Permission denied on bucket"

1. Vérifier que le Service Account a les rôles :
   - `roles/storage.objectAdmin`
   - `roles/storage.objectViewer`

2. Vérifier les permissions du bucket :
   ```bash
   gsutil iam get gs://seniorhub-photos-production
   ```

### Erreur : "Invalid private key"

1. Vérifier que `GCS_PRIVATE_KEY` contient les sauts de ligne `\n` :
   ```bash
   -----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----
   ```

2. Ou utiliser `GCP_SERVICE_ACCOUNT_KEY_BASE64` à la place.

### Erreur : "Bucket not found"

1. Vérifier `GCS_BUCKET_NAME` (exactement le même nom)
2. Vérifier `GCS_PROJECT_ID` (le projet où se trouve le bucket)

### Images non accessibles publiquement

1. Vérifier les permissions du bucket :
   ```bash
   gsutil acl get gs://seniorhub-photos-production
   ```

2. Ajouter `allUsers` avec rôle `READER` :
   ```bash
   gsutil iam ch allUsers:objectViewer gs://seniorhub-photos-production
   ```

## 📊 Monitoring

### Google Cloud Console

1. **Cloud Storage** → votre bucket → **Monitoring**
   - Requêtes par seconde
   - Bandwidth
   - Stockage utilisé

2. **Logging** → filtrer par :
   ```
   resource.type="gcs_bucket"
   resource.labels.bucket_name="seniorhub-photos-production"
   ```

### Alertes recommandées

1. **Stockage > 80%** du quota
2. **Egress > 1TB/mois** (dépassement du free tier)
3. **Erreurs 4xx/5xx** > 1%

## ♻️ Gestion du cycle de vie

### Suppression automatique des anciennes photos

Créer une règle de lifecycle dans le bucket :

1. Bucket → **Configuration** → **Lifecycle**
2. **Add rule**
3. Configuration :
   - **Object conditions** : Age > 90 days
   - **Action** : Delete

### Versioning (optionnel)

Pour récupérer des photos supprimées par erreur :

1. Bucket → **Protection** → **Object versioning**
2. Activer **Object versioning**
3. Configurer la règle de lifecycle pour supprimer les anciennes versions

## 🎯 Résumé

Google Cloud Storage est la solution de stockage unique pour Senior Hub. Elle offre :

| Critère | Google Cloud Storage |
|---------|---------------------|
| **Free Tier** | ✅ Permanent (5GB) |
| **Cohérence** | ✅ Déjà sur GCP |
| **Prix** | ✅ ~$3-7/mois |
| **Simplicité** | ✅ Un seul compte |
| **CDN** | ✅ Intégré |
| **Performance** | ✅ Excellent |
| **Sécurité** | ✅ IAM + signed URLs |

**🏆 GCS est le choix idéal pour votre application !**

## 🔗 Ressources

- [Documentation GCS](https://cloud.google.com/storage/docs)
- [Guide IAM pour GCS](https://cloud.google.com/storage/docs/access-control/iam)
- [Prix GCS](https://cloud.google.com/storage/pricing)
- [Guide Railway + GCS](RAILWAY_GCS_SETUP.md)
