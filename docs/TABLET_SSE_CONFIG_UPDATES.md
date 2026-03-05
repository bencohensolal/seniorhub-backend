# Tablet Real-Time Config Updates via SSE

## Overview

Les tablettes peuvent maintenant recevoir des notifications en temps réel quand leur configuration est modifiée, grâce aux **Server-Sent Events (SSE)**. Plus besoin de polling ou de rafraîchissement manuel !

## Comment ça fonctionne

### 1. Connexion SSE

Quand une tablette démarre ou s'authentifie, elle doit établir une connexion SSE persistante :

**Endpoint :** `GET /v1/households/{householdId}/display-tablets/{tabletId}/config-updates`

**Headers requis :**
- `x-tablet-session-token: {sessionToken}` (obtenu après authentification)

**Exemple de connexion (React Native / Expo) :**

```typescript
import { EventSource } from 'react-native-sse';

const eventSource = new EventSource(
  `${API_BASE_URL}/v1/households/${householdId}/display-tablets/${tabletId}/config-updates`,
  {
    headers: {
      'x-tablet-session-token': sessionToken,
    },
  }
);

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'connected':
      console.log('✅ Connected to config update stream');
      break;
      
    case 'config-updated':
      console.log('🔄 Config updated! Refreshing...');
      // Fetch fresh config and reload display
      await fetchAndApplyConfig();
      break;
      
    case 'heartbeat':
      // Keep-alive ping (every 30s)
      break;
  }
});

eventSource.addEventListener('error', (error) => {
  console.error('SSE connection error:', error);
  // Attempt reconnection
});

eventSource.addEventListener('open', () => {
  console.log('SSE connection opened');
});
```

### 2. Types d'événements reçus

#### `connected`
Confirmé immédiatement après la connexion.
```json
{
  "type": "connected",
  "message": "Connected to config update stream",
  "timestamp": "2026-05-03T18:00:00.000Z"
}
```

#### `config-updated`
Envoyé quand un utilisateur modifie la config via l'app mobile.
```json
{
  "type": "config-updated",
  "message": "Configuration has been updated",
  "timestamp": "2026-05-03T18:05:30.000Z",
  "data": {
    "lastUpdated": "2026-05-03T18:05:30.418Z"
  }
}
```

**Action recommandée :** Fetcher la nouvelle config immédiatement via :
```typescript
GET /v1/households/{householdId}/display-tablets/{tabletId}/config
```

#### `heartbeat`
Envoyé toutes les 30 secondes pour maintenir la connexion.
```json
{
  "type": "heartbeat",
  "timestamp": "2026-05-03T18:05:00.000Z"
}
```

### 3. Gestion des reconnexions

La connexion SSE peut être interrompue (perte réseau, redémarrage serveur, etc.). Implémentez une logique de reconnexion automatique :

```typescript
class TabletConfigSSE {
  private eventSource: EventSource | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private maxReconnectDelay = 30000; // 30 secondes max
  private reconnectDelay = 1000; // Start at 1 second
  
  connect() {
    if (this.eventSource) {
      this.eventSource.close();
    }
    
    this.eventSource = new EventSource(/* ... */);
    
    this.eventSource.addEventListener('open', () => {
      console.log('✅ SSE connected');
      this.reconnectDelay = 1000; // Reset delay on success
    });
    
    this.eventSource.addEventListener('error', (error) => {
      console.error('❌ SSE error:', error);
      this.eventSource?.close();
      this.scheduleReconnect();
    });
    
    this.eventSource.addEventListener('message', this.handleMessage);
  }
  
  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(() => {
      console.log(`🔄 Reconnecting SSE (delay: ${this.reconnectDelay}ms)...`);
      this.connect();
      
      // Exponential backoff
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay
      );
    }, this.reconnectDelay);
  }
  
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
  
  private handleMessage = (event: MessageEvent) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'config-updated') {
      // Trigger config refresh
      this.onConfigUpdated?.();
    }
  };
  
  onConfigUpdated?: () => void;
}

// Usage
const sseClient = new TabletConfigSSE();
sseClient.onConfigUpdated = async () => {
  const newConfig = await fetchConfig();
  applyConfig(newConfig);
};
sseClient.connect();
```

### 4. Cycle de vie complet

```
1. Tablette démarre
   ↓
2. Authentification (POST /v1/display-tablets/authenticate)
   ↓
3. Fetch config initial (GET .../config)
   ↓
4. Établir connexion SSE (GET .../config-updates)
   ↓
5. Afficher interface avec config
   ↓
6. [Utilisateur modifie config dans l'app]
   ↓
7. Backend émet événement SSE "config-updated"
   ↓
8. Tablette reçoit événement
   ↓
9. Tablette fetch nouvelle config (GET .../config)
   ↓
10. Tablette applique nouveau config et refresh UI
    ↓
11. Utilisateur voit changements instantanément ! ✨
```

## Sécurité

- ✅ Seules les tablettes authentifiées peuvent se connecter
- ✅ Une tablette ne peut s'abonner qu'à ses propres updates
- ✅ Validation stricte du `tabletId` et `householdId`
- ✅ Auto-cleanup des connexions mortes (heartbeat)

## Avantages vs Polling

| Critère | SSE (nouvelle méthode) | Polling |
|---------|----------------------|---------|
| Latence | < 1 seconde | 30-60 secondes |
| Bande passante | Très faible | Élevée |
| Impact batterie | Minimal | Modéré |
| Scalabilité | Excellente | Limitée |
| Complexité | Moyenne | Faible |

## Notes d'implémentation

1. **Pas de fallback nécessaire :** Si SSE échoue, la tablette peut continuer à fonctionner avec la config en cache. Le refresh se fera au prochain redémarrage.

2. **Compatible réseau instable :** La reconnexion automatique gère les coupures réseau courantes.

3. **Pas de surcharge serveur :** Le heartbeat (30s) est suffisamment espacé pour ne pas impacter les performances.

4. **Thread séparé recommandé :** Gérez SSE dans un service/contexte séparé pour ne pas bloquer l'UI.

## Dépendances React Native

```bash
npm install react-native-sse
# ou
yarn add react-native-sse
```

## Exemple complet d'intégration

Voir le fichier exemple dans l'app mobile : `src/services/TabletConfigSSEService.ts`

## Support

En cas de problème avec SSE :
1. Vérifier les logs backend pour confirmation de connexion
2. Tester la connexion SSE manuellement avec curl
3. Vérifier que le token tablet est valide
4. Consulter les métriques Railway pour voir les connexions actives

## Changelog

- **2026-05-03** : Implémentation initiale SSE pour config updates
