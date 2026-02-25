# Households Routes Module

This directory contains the refactored households routes, organized into smaller, focused modules.

## Architecture

The routes have been split from a single 752-line monolithic file into the following structure:

```
routes/households/
├── index.ts                  # Main entry point, orchestrates all modules
├── schemas.ts                # Zod validation schemas and JSON schemas
├── utils.ts                  # Utility functions (rate limiting, sanitization)
├── householdRoutes.ts        # Household management routes
├── invitationRoutes.ts       # Invitation management routes
└── observabilityRoutes.ts    # Observability/metrics routes
```

## Modules

### index.ts (60 lines)
- **Purpose**: Main plugin entry point
- **Responsibilities**: 
  - Initialize repository and use cases
  - Register sub-route modules
  - Provide dependency injection to route handlers

### schemas.ts (45 lines)
- **Purpose**: Centralize all validation and schema definitions
- **Exports**:
  - Zod schemas for request validation
  - JSON schemas for OpenAPI documentation
- **Benefits**: Single source of truth for data shapes

### utils.ts (55 lines)
- **Purpose**: Shared utility functions
- **Exports**:
  - `checkInviteRateLimit`: Rate limiting logic
  - `maskEmail`: Email sanitization
  - `sanitizeInvitation`: Invitation response formatting
- **Benefits**: Reusable logic, easier to test

### householdRoutes.ts (~200 lines)
- **Purpose**: Household management endpoints
- **Routes**:
  - `POST /v1/households` - Create household
  - `GET /v1/households/my-households` - List user households
  - `GET /v1/households/:householdId/overview` - Get household details
- **Responsibility**: CRUD operations for households

### invitationRoutes.ts (~460 lines)
- **Purpose**: Invitation management endpoints
- **Routes**:
  - `POST /v1/households/:householdId/invitations/bulk` - Create invitations
  - `GET /v1/households/invitations/my-pending` - List pending invitations
  - `GET /v1/households/invitations/resolve` - Resolve invitation by token
  - `POST /v1/households/invitations/accept` - Accept invitation
  - `POST /v1/households/:householdId/invitations/:invitationId/cancel` - Cancel invitation
- **Responsibility**: Full invitation lifecycle management

### observabilityRoutes.ts (~40 lines)
- **Purpose**: Observability and metrics endpoints
- **Routes**:
  - `GET /v1/observability/invitations/email-metrics` - Get email metrics
- **Responsibility**: Monitoring and observability

## Benefits of This Structure

### 1. **Separation of Concerns**
- Each file has a single, well-defined responsibility
- Schemas, utils, and routes are cleanly separated
- Easy to locate and modify specific functionality

### 2. **Improved Maintainability**
- Smaller files are easier to understand and navigate
- Changes to one domain don't affect others
- Reduced cognitive load when working on specific features

### 3. **Better Testability**
- Utilities can be tested independently
- Schemas are isolated and testable
- Route handlers are focused and easier to unit test

### 4. **Scalability**
- Easy to add new routes in the appropriate module
- Can extract domains further if they grow too large
- Clear pattern for future feature additions

### 5. **Reusability**
- Shared utilities and schemas can be used across modules
- Easier to extract common patterns
- Reduces code duplication

## Migration Notes

The refactoring was performed with zero functional changes:
- All routes maintain the same URLs and behavior
- All validation logic is preserved
- All error handling remains consistent
- OpenAPI schemas are identical

## Future Improvements

### Potential Next Steps
1. **Extract more shared types**: Consider creating a `types.ts` for shared TypeScript interfaces
2. **Add route-specific tests**: Create test files for each route module
3. **Extract middleware**: If rate limiting grows, consider extracting to a middleware
4. **Schema composition**: Use Zod's composition features for even better schema reuse

### If Routes Continue Growing
- **householdRoutes.ts**: Still manageable at ~200 lines
- **invitationRoutes.ts**: Could be split further if it exceeds 500 lines:
  - `invitationCreationRoutes.ts` (bulk create)
  - `invitationResolutionRoutes.ts` (resolve, accept)
  - `invitationManagementRoutes.ts` (list, cancel)

## Usage

The module is imported and registered in `app.ts`:

```typescript
import { householdsRoutes } from './routes/households/index.js';
app.register(householdsRoutes);
```

All routes are automatically registered through the plugin system.
