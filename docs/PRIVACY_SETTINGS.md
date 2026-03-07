# Privacy Settings Feature

## Overview

The privacy settings feature allows users to control how their personal information and health data is shared within their household. This implements the foundation for privacy controls described in the mobile app requirements.

## Endpoints

### GET /v1/users/me/privacy-settings

Retrieve the authenticated user's privacy settings.

**Headers:**
- `x-user-id`: User ID (required)
- `x-user-email`: User email (required)

**Response 200:**
```json
{
  "data": {
    "shareProfile": true,
    "shareHealthData": true,
    "shareActivityHistory": true,
    "allowAnalytics": false
  }
}
```

**Default Values:**
If a user has never configured their privacy settings, the API returns defaults:
- `shareProfile`: `true`
- `shareHealthData`: `true`
- `shareActivityHistory`: `true`
- `allowAnalytics`: `false`

### PUT /v1/users/me/privacy-settings

Update the authenticated user's privacy settings. Only the user themselves can update their own settings.

**Headers:**
- `x-user-id`: User ID (required)
- `x-user-email`: User email (required)
- `x-write-permission`: Must be `true`

**Request Body:**
```json
{
  "shareProfile": false,
  "shareHealthData": true,
  "shareActivityHistory": true,
  "allowAnalytics": false
}
```

All fields are optional. Only provided fields will be updated.

**Response 200:**
```json
{
  "data": {
    "shareProfile": false,
    "shareHealthData": true,
    "shareActivityHistory": true,
    "allowAnalytics": false,
    "updatedAt": "2026-03-07T06:39:00.000Z"
  }
}
```

## Privacy Settings Explained

### shareProfile
Controls whether the user's first name and last name are visible to other household members.

- **true**: Full name is displayed
- **false**: Name is anonymized as "User User"

**Current Implementation:** P0 endpoint infrastructure complete. Profile anonymization filtering in data responses is **deferred to P1**.

### shareHealthData
Controls whether the user's health-related data (medications, appointments) is visible to other household members.

- **true**: Health data is visible to all household members
- **false**: Health data is only visible to the user who created it

**Current Implementation:** P0 endpoint infrastructure complete. Health data filtering in medications/appointments is **deferred to P1**.

### shareActivityHistory
Controls whether the user's activity history (task completions, action logs) is visible to other household members.

- **true**: Activity history is visible
- **false**: Activity is anonymized or hidden

**Current Implementation:** P0 endpoint infrastructure complete. Activity filtering in tasks is **deferred to P2**.

### allowAnalytics
Controls whether the user's data can be included in anonymous analytics.

- **true**: User data may be included in analytics
- **false**: User data is excluded from analytics

**Current Implementation:** P0 endpoint infrastructure complete. Analytics exclusion is **deferred to P3**.

## Database Schema

```sql
CREATE TABLE user_privacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_profile BOOLEAN NOT NULL DEFAULT TRUE,
  share_health_data BOOLEAN NOT NULL DEFAULT TRUE,
  share_activity_history BOOLEAN NOT NULL DEFAULT TRUE,
  allow_analytics BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX idx_user_privacy_settings_user_id ON user_privacy_settings(user_id);
```

## Implementation Status

### ✅ P0 Complete (Basic Infrastructure)
- [x] Database migration (`019_user_privacy_settings.sql`)
- [x] Domain entity (`PrivacySettings`)
- [x] Repository methods (Postgres + InMemory)
- [x] Use cases (Get/Update)
- [x] API endpoints (GET/PUT `/v1/users/me/privacy-settings`)
- [x] Type-safe schemas and validation

### 🔄 P1 Deferred (Privacy Filtering)
The following filtering logic will be implemented in a follow-up task:
- [ ] Apply `shareProfile` filtering in medication/appointment/task responses
- [ ] Apply `shareHealthData` filtering when listing medications
- [ ] Apply `shareHealthData` filtering when listing appointments
- [ ] Implement privacy-aware `getBulkPrivacySettings` usage in list endpoints
- [ ] Add `createdBy` user information with privacy filtering to responses

### 🔄 P2 Deferred (Activity History)
- [ ] Apply `shareActivityHistory` filtering in task completion history
- [ ] Anonymize task `completedBy` based on privacy settings

### 🔄 P3 Deferred (Analytics)
- [ ] Implement analytics exclusion based on `allowAnalytics`

## Security Notes

- ✅ Users can only modify their own privacy settings
- ✅ All endpoints require authentication (x-user-id header)
- ✅ PUT endpoint requires write permission
- ✅ Settings are stored per-user with unique constraint
- ✅ Cascade delete on user removal

## App Integration

The mobile app implements client-side validation before sending requests:
- If `shareHealthData=false`, the app prevents creating/updating medications and appointments
- If `shareActivityHistory=false`, the app prevents completing tasks

The backend **does not** enforce these validations. The app is responsible for UX flow control.

## Future Considerations

1. **Emergency Override**: Consider implementing a temporary emergency access mechanism
2. **Notification Impact**: Determine how privacy settings affect reminder notifications
3. **Audit Logging**: Track all privacy settings changes for compliance
4. **Retroactive Application**: Clarify if settings apply to existing data vs. future data only

## Migration

Run migration 019:
```bash
npm run migrate
```

Or for Railway deployment:
```bash
./scripts-db/run-railway-migration.sh 019
```
