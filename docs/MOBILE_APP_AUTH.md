# Mobile App Authentication Guide

## Current Backend Authentication

The backend supports **two authentication methods**:

### Method 1: Bearer Token (JWT)
```typescript
headers: {
  'Authorization': 'Bearer <jwt_token>',
}
```

**⚠️ Important:** The backend expects a standard JWT with these fields in the payload:
- `sub` or `userId` or `user_id` → User ID
- `email` → User email
- `firstName` or `given_name` or `first_name` → First name (optional)
- `lastName` or `family_name` or `last_name` → Last name (optional)

### Method 2: x-user-* Headers ✅ RECOMMENDED FOR NOW
```typescript
headers: {
  'x-user-id': userId,
  'x-user-email': email,
  'x-user-first-name': firstName,
  'x-user-last-name': lastName,
}
```

## Current Issue

The mobile app is sending a Bearer token (probably from Firebase/Supabase) that the backend cannot decode properly, resulting in:

```json
{
  "status": "error",
  "message": "Authentication required. Provide either Bearer token or x-user-* headers."
}
```

## Solution for Mobile App

**Update `ApiTaskRepository.ts` (and all API repositories) to use x-user-* headers:**

```typescript
// In ApiTaskRepository.ts (and similar files)
async createTask(householdId: string, task: CreateTaskInput): Promise<Task> {
  const url = `${this.baseUrl}/v1/households/${householdId}/tasks`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    // Use x-user-* headers instead of Authorization
    'x-user-id': this.userContext.userId,
    'x-user-email': this.userContext.email,
    'x-user-first-name': this.userContext.firstName || '',
    'x-user-last-name': this.userContext.lastName || '',
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(task),
  });

  // ... rest of the code
}
```

## Testing

Once updated, test with curl:

```bash
# This should work
curl -X POST https://seniorhub-backend-production.up.railway.app/v1/households/{householdId}/tasks \
  -H "Content-Type: application/json" \
  -H "x-user-id: {userId}" \
  -H "x-user-email: {email}" \
  -H "x-user-first-name: {firstName}" \
  -H "x-user-last-name: {lastName}" \
  -d '{
    "title": "Test Task",
    "seniorId": "{seniorId}",
    "category": "hydration"
  }'
```

## Long-term Solution

To support Firebase/Supabase tokens properly, the backend needs to:

1. Install and configure proper JWT verification library (e.g., `jsonwebtoken`, `jose`)
2. Add Firebase/Supabase public keys configuration
3. Verify JWT signatures instead of just base64 decoding

This can be implemented later. For now, **use x-user-* headers**.

## Migration Checklist for App

- [ ] Update `ApiTaskRepository.ts` to use x-user-* headers
- [ ] Update `ApiHouseholdRepository.ts` (if using Bearer)
- [ ] Update `ApiMedicationRepository.ts` (if using Bearer)
- [ ] Update `ApiAppointmentRepository.ts` (if using Bearer)
- [ ] Update any other API repository files
- [ ] Test all endpoints
- [ ] Remove Authorization header if no longer needed

## Backend Files Reference

- Middleware: `src/plugins/authContext.ts`
- App registration: `src/app.ts`
- Documentation: `docs/AUTHENTICATION.md`
