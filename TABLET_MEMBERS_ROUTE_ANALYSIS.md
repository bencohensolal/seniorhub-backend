# Tablet Members Route Analysis

## Executive Summary

✅ **The route IS configured to accept tablet authentication**  
❌ **But there may be a token verification issue**

## Current Configuration

### 1. Global Authentication Middleware (`src/plugins/authContext.ts`)

The global auth middleware handles tablet authentication:

```typescript
// Line 108: Try tablet authentication first
const tabletSessionToken = normalize(request.headers['x-tablet-session-token'] as string | undefined);

if (tabletSessionToken) {
  const tabletPayload = verifyTabletSessionToken(tabletSessionToken);
  
  if (tabletPayload) {
    // Valid tablet session - set tablet context
    request.tabletSession = {
      tabletId: tabletPayload.tabletId,
      householdId: tabletPayload.householdId,
      permissions: tabletPayload.permissions,
      isTablet: true,
    };
    
    return; // ✅ Returns early - no 401 here
  } else {
    // ❌ Invalid tablet token - THIS is where 401 happens
    return reply.status(401).send({
      status: 'error',
      message: 'Invalid or expired tablet session token.',
    });
  }
}
```

### 2. Members Route PreHandler (`src/routes/households/householdRoutes.ts`)

The route explicitly allows both user and tablet auth:

```typescript
// Line 278-295
preHandler: async (request: any, reply: any) => {
  // Allow both user auth and tablet auth
  if (!request.requester && !request.tabletSession) {
    return reply.status(401).send({
      status: 'error',
      message: 'Authentication required. Provide user credentials or tablet session.',
    });
  }
  
  // If tablet, verify it's accessing its own household
  if (request.tabletSession) {
    const params = request.params as any;
    if (request.tabletSession.householdId !== params.householdId) {
      return reply.status(403).send({
        status: 'error',
        message: 'Tablets can only access their own household members.',
      });
    }
  }
},
```

### 3. Use Case (`src/domain/usecases/households/ListHouseholdMembersUseCase.ts`)

The use case works with tablets:

```typescript
async execute(input: { householdId: string; requester: AuthenticatedRequester }): Promise<Member[]> {
  // Verify requester is a member of this household
  await this.accessValidator.ensureMember(input.requester.userId, input.householdId);
  
  // Get all active members of the household
  const members = await this.repository.listHouseholdMembers(input.householdId);
  
  return members;
}
```

### 4. Access Validator (`src/domain/usecases/shared/HouseholdAccessValidator.ts`)

The validator handles tablet authentication correctly:

```typescript
async ensureMember(userId: string, householdId: string): Promise<Member | null> {
  // Tablet authentication: synthetic userId format "tablet:{tabletId}"
  // Tablets are validated at the route level via verifyTabletHouseholdAccess()
  // so we skip member validation here
  if (userId.startsWith('tablet:')) {
    return null; // ✅ Return null for tablet requests (no member entity)
  }
  
  const member = await this.repository.findActiveMemberByUserInHousehold(userId, householdId);
  
  if (!member) {
    throw new ForbiddenError('Access denied to this household.');
  }
  
  return member;
}
```

## Root Cause Analysis

Based on the error message you're receiving:

```
Response: 401
{
  "status": "error",
  "message": "Invalid or expired tablet session token."
}
```

This error comes from **line 126 of `src/plugins/authContext.ts`**, which means:

❌ **`verifyTabletSessionToken(tabletSessionToken)` is returning `null` or `false`**

This happens BEFORE the route's preHandler even runs.

## Why Does This Work for Other Routes?

All routes use the same global auth middleware. If the token works for:
- ✅ Appointments
- ✅ Occurrences
- ✅ Tasks

Then it should work for Members too, since they all go through the same authentication pipeline.

## Debugging Steps

### Step 1: Verify Token Format

The token should be a valid JWT. Check the token structure:

```bash
# Split the JWT and decode the payload
TOKEN="your-tablet-session-token-here"
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq
```

Expected payload:
```json
{
  "tabletId": "...",
  "householdId": "...",
  "permissions": [...]
}
```

### Step 2: Check Token Verification Function

The issue is in `src/domain/security/displayTabletSession.ts`:

```typescript
export const verifyTabletSessionToken = (token: string): TabletSessionPayload | null => {
  // Check this function's implementation
}
```

### Step 3: Add Logging

Add temporary logging to `src/plugins/authContext.ts` line 108:

```typescript
if (tabletSessionToken) {
  fastify.log.info({ 
    token: tabletSessionToken.substring(0, 30) + '...',
    path: request.url 
  }, 'Attempting tablet authentication');
  
  const tabletPayload = verifyTabletSessionToken(tabletSessionToken);
  
  fastify.log.info({ 
    verified: !!tabletPayload,
    path: request.url 
  }, 'Tablet token verification result');
  
  if (tabletPayload) {
    // ...
```

### Step 4: Test with cURL

```bash
# Test the members endpoint
curl -X GET \
  'http://localhost:3000/v1/households/YOUR_HOUSEHOLD_ID/members' \
  -H 'Content-Type: application/json' \
  -H 'x-tablet-session-token: YOUR_TABLET_TOKEN' \
  -v
```

Compare with a working endpoint:

```bash
# Test appointments (working)
curl -X GET \
  'http://localhost:3000/v1/households/YOUR_HOUSEHOLD_ID/appointments' \
  -H 'Content-Type: application/json' \
  -H 'x-tablet-session-token: YOUR_TABLET_TOKEN' \
  -v
```

### Step 5: Check Server Logs

Look for these log entries:
- `Tablet authenticated via session token` (success)
- `Invalid tablet session token` (failure)

## Possible Issues

### Issue 1: Token Expiration

The token might have expired between requests. Check:

```typescript
// In displayTabletSession.ts
export const verifyTabletSessionToken = (token: string): TabletSessionPayload | null => {
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    // Check if 'exp' claim is valid
    return decoded as TabletSessionPayload;
  } catch (error) {
    // Token expired or invalid signature
    return null;
  }
}
```

### Issue 2: Secret Key Mismatch

If the secret key used to sign the token doesn't match the verification key, validation will fail.

### Issue 3: Token Format

The token might not be properly formatted as a JWT.

## Recommended Fix

If the token is genuinely valid (works for other endpoints), check the token verification function:

```bash
cat src/domain/security/displayTabletSession.ts
```

Look for any environment-specific issues or timing-related validation.

## Next Steps

1. **Read the token verification implementation**
2. **Add logging to track where verification fails**
3. **Compare the exact same token against multiple endpoints**
4. **Check if there's any caching or timing issue**

## Configuration Verdict

✅ **Route configuration is CORRECT**  
✅ **PreHandler is CORRECT**  
✅ **Use case is CORRECT**  
✅ **Access validator is CORRECT**  

❓ **Token verification function needs investigation**
