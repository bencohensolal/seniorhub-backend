# Tablet Photo Screens Integration

## Overview

Les écrans photo sont désormais complètement intégrés dans la configuration de la tablette d'affichage. Quand un utilisateur crée, modifie ou supprime des photo screens depuis le téléphone, la tablette reçoit automatiquement les mises à jour via SSE et peut afficher les photos instantanément.

## Architecture

### 1. Récupération de la Configuration

L'endpoint `GET /v1/households/:householdId/display-tablets/:tabletId/config` retourne maintenant la configuration complète incluant les photo screens:

```typescript
GET /v1/households/:householdId/display-tablets/:tabletId/config
```

**Response:**
```json
{
  "success": true,
  "data": {
    "slideDuration": 10000,
    "dataCacheDuration": 300000,
    "dataRefreshInterval": 300000,
    "screens": [
      {
        "type": "summary",
        "enabled": true,
        "order": 0,
        "settings": { ... }
      },
      {
        "type": "photoGallery",
        "enabled": true,
        "order": 6,
        "settings": {
          "id": "ps_abc123",
          "name": "Vacances été 2025",
          "photos": [
            {
              "id": "ph_001",
              "url": "https://storage.googleapis.com/.../photo.jpg",
              "caption": "Au bord de la mer",
              "order": 0,
              "uploadedAt": "2026-03-06T12:35:00.000Z"
            },
            {
              "id": "ph_002",
              "url": "https://storage.googleapis.com/.../photo2.jpg",
              "caption": null,
              "order": 1,
              "uploadedAt": "2026-03-06T12:36:00.000Z"
            }
          ],
          "displayMode": "slideshow",
          "slideshowDuration": 5,
          "slideshowTransition": "fade",
          "slideshowOrder": "sequential",
          "showCaptions": true
        }
      }
    ],
    "lastUpdated": "2026-03-06T13:00:00.000Z"
  }
}
```

### 2. Construction Dynamique

Le `GetTabletConfigUseCase` construit dynamiquement la configuration:

1. **Récupère la config de base** depuis `display_tablets.config`
2. **Liste tous les photo screens** depuis la table `photo_screens`
3. **Fusionne les données**: Les photo screens sont ajoutés en tant que `ScreenConfig` de type `photoGallery`
4. **Ordre automatique**: Les photo screens sont placés après les autres écrans

```typescript
// Les photo screens sont automatiquement convertis en ScreenConfig
{
  type: 'photoGallery',
  enabled: true,  // Toujours activés s'ils existent
  order: maxExistingOrder + 1 + index,
  settings: {
    id: photoScreen.id,
    name: photoScreen.name,
    photos: photoScreen.photos,
    displayMode: photoScreen.displayMode,
    // ... autres settings
  }
}
```

### 3. Notifications en Temps Réel

Toutes les opérations sur les photo screens déclenchent une notification SSE vers la tablette:

**Opérations qui notifient:**
- ✅ Création d'un photo screen
- ✅ Modification d'un photo screen (nom, mode d'affichage, etc.)
- ✅ Suppression d'un photo screen
- ✅ Upload d'une photo
- ✅ Modification d'une photo (caption, order)
- ✅ Suppression d'une photo
- ✅ Réordonnancement des photos

**Événement SSE envoyé:**
```
event: config-updated
data: {"type":"config-updated","message":"Configuration has been updated","timestamp":"2026-03-06T18:05:30.000Z","data":{"lastUpdated":"2026-03-06T18:05:30.418Z"}}

```

### 4. Cycle de Vie Complet

```
┌─────────────────┐
│  Mobile App     │
│  (Caregiver)    │
└────────┬────────┘
         │
         │ POST /photo-screens
         │ (Create photo screen)
         ↓
┌─────────────────┐
│    Backend      │
│  Use Case       │
└────────┬────────┘
         │
         ├─→ 1. Validate permissions
         ├─→ 2. Check limits (max 5 screens)
         ├─→ 3. Create in database
         ├─→ 4. Notify via SSE ✨
         │
         ↓
┌─────────────────┐
│  Tablet (SSE)   │
│  Listening      │
└────────┬────────┘
         │
         │ Receive: config-updated
         │
         ↓
┌─────────────────┐
│  Tablet App     │
│  Fetch Config   │
└────────┬────────┘
         │
         │ GET /config
         ↓
┌─────────────────┐
│  GetTabletConfig│
│  UseCase        │
└────────┬────────┘
         │
         ├─→ 1. Get base config
         ├─→ 2. List photo screens
         ├─→ 3. Merge into config
         ├─→ 4. Return complete config
         │
         ↓
┌─────────────────┐
│  Tablet Display │
│  Shows Photos   │
└─────────────────┘
```

## Endpoints API pour la Tablette

### Authentication

La tablette peut s'authentifier de deux manières:

**Méthode 1: Credentials directs (utilisé actuellement)**
```bash
curl -H "x-tablet-id: tb_123" \
     -H "x-tablet-token: abc..." \
     http://api/v1/households/hh_123/display-tablets/tb_123/config
```

**Méthode 2: JWT Session Token**
```bash
# 1. Authenticate
POST /v1/display-tablets/authenticate
{ "tabletId": "tb_123", "token": "abc..." }

# 2. Use session token
curl -H "x-tablet-session-token: eyJ..." \
     http://api/v1/households/hh_123/display-tablets/tb_123/config
```

### SSE Connection

```javascript
const eventSource = new EventSource(
  `${API_URL}/v1/households/${householdId}/display-tablets/${tabletId}/config-updates`,
  {
    headers: {
      'x-tablet-id': tabletId,
      'x-tablet-token': tabletToken,
    },
  }
);

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'config-updated') {
    // Refresh config
    await fetchAndApplyConfig();
  }
});
```

## Gestion des Photo Screens (Mobile App)

### Création d'un Photo Screen

```bash
POST /v1/households/:householdId/display-tablets/:tabletId/photo-screens
Authorization: Bearer <userToken>

{
  "name": "Vacances 2025",
  "displayMode": "slideshow",
  "slideshowDuration": 5,
  "slideshowTransition": "fade",
  "slideshowOrder": "sequential",
  "showCaptions": true
}
```

**➡️ Déclenche SSE vers la tablette**

### Upload d'une Photo

```bash
POST /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos
Authorization: Bearer <userToken>
Content-Type: multipart/form-data

FormData:
  - photo: <file>
  - caption: "Au bord de la mer"
  - order: 0
```

**➡️ Déclenche SSE vers la tablette**

### Modification d'un Photo Screen

```bash
PUT /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId
Authorization: Bearer <userToken>

{
  "displayMode": "mosaic",
  "showCaptions": false
}
```

**➡️ Déclenche SSE vers la tablette**

### Réordonnancement des Photos

```bash
PUT /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos/reorder
Authorization: Bearer <userToken>

{
  "photoOrders": [
    { "id": "ph_002", "order": 0 },
    { "id": "ph_001", "order": 1 }
  ]
}
```

**➡️ Déclenche SSE vers la tablette**

### Suppression

```bash
DELETE /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos/:photoId
# ➡️ Déclenche SSE

DELETE /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId
# ➡️ Déclenche SSE et supprime toutes les photos du storage
```

## Limites et Contraintes

- **Max 5 photo screens par tablette** (`MAX_PHOTO_SCREENS_PER_TABLET`)
- **Max 6 photos par screen** (`MAX_PHOTOS_PER_SCREEN`)
- **Max 5 MB par photo** (`MAX_PHOTO_SIZE_MB`)
- **Max 100 caractères pour les captions** (`MAX_PHOTO_CAPTION_LENGTH`)
- **Formats supportés**: JPEG, PNG, WebP

## Sécurité

### Permissions

- **Création/modification/suppression**: Caregivers uniquement
- **Lecture (via config)**: Tous les membres du household + la tablette elle-même

### Storage

- **GCS** (Google Cloud Storage) pour Railway deployment
- **S3** (AWS) alternative supportée
- URLs publiques avec CDN pour performance
- Nettoyage automatique lors de la suppression

## Performance

### Optimisations

1. **SSE plutôt que polling**: Latence < 1 seconde vs 30-60 secondes
2. **CDN caching**: Les photos sont servies via CDN avec cache
3. **Lazy loading**: La tablette charge les images à la demande
4. **Batch operations**: Reorder multiple photos en une requête

### Monitoring

```typescript
// Check active SSE connections
tabletConfigNotifier.getActiveConnectionCount()

// Check if tablet is connected
tabletConfigNotifier.isTabletConnected(tabletId)
```

## Testing

### Test SSE Integration

```bash
# 1. Connect tablet via SSE
curl -N -H "x-tablet-id: tb_123" \
       -H "x-tablet-token: abc..." \
       http://localhost:3000/v1/households/hh_123/display-tablets/tb_123/config-updates

# 2. In another terminal, create a photo screen
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test"}' \
     http://localhost:3000/v1/households/hh_123/display-tablets/tb_123/photo-screens

# 3. Observe SSE event in first terminal
# event: config-updated
# data: {"type":"config-updated", ...}
```

### Test Config Fetch

```bash
curl -H "x-tablet-id: tb_123" \
     -H "x-tablet-token: abc..." \
     http://localhost:3000/v1/households/hh_123/display-tablets/tb_123/config

# Should return config with photoGallery screens included
```

## Troubleshooting

### Photo Screens not appearing in config

- ✅ Verify photo screens exist in database: `SELECT * FROM photo_screens WHERE tablet_id = '...'`
- ✅ Check `GetTabletConfigUseCase` is being used (not reading config directly)
- ✅ Verify tablet belongs to correct household

### SSE notifications not received

- ✅ Check tablet is connected: `tabletConfigNotifier.isTabletConnected(tabletId)`
- ✅ Verify credentials are correct
- ✅ Check server logs for SSE errors
- ✅ Test with curl to isolate client issues

### Photos not loading on tablet

- ✅ Verify URLs are accessible (try opening in browser)
- ✅ Check GCS/S3 bucket permissions
- ✅ Verify CDN configuration
- ✅ Check network connectivity from tablet

## Future Enhancements

- [ ] Signed URLs pour enhanced security
- [ ] Thumbnail generation pour previews
- [ ] Batch photo upload
- [ ] Photo metadata (EXIF, location)
- [ ] Storage quotas per household
- [ ] Photo categories/tags
- [ ] Face detection
- [ ] AI-generated captions

## Related Documentation

- [`docs/PHOTO_SCREENS_FEATURE.md`](./PHOTO_SCREENS_FEATURE.md) - Feature specification
- [`docs/TABLET_SSE_CONFIG_UPDATES.md`](./TABLET_SSE_CONFIG_UPDATES.md) - SSE implementation
- [`docs/TABLET_AUTHENTICATION_FLOW.md`](./TABLET_AUTHENTICATION_FLOW.md) - Tablet auth
- [`docs/GCS_SETUP.md`](./GCS_SETUP.md) - Storage configuration
