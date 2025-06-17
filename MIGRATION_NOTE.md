# Database Migration Note

## Changes Made

### Removed Unique Constraint on Product Tracking

**Date**: Current update
**Reason**: Allow users to track the same product multiple times

**Changes**:
1. Removed `@@unique([productId, userId])` constraint from `ProductTracking` model
2. Updated tracking API to always create new tracking records instead of updating existing ones
3. Added authentication requirement to ensure `userId` is never null

**To Apply Migration**:
```bash
npx prisma db push
```

**Impact**:
- Users can now track the same product multiple times
- Each tracking instance gets its own lifecycle events
- Better support for tracking products from different sources or contexts
- Proper user association is now enforced (no more null userIds)

**Notes**:
- Existing tracking records with null userIds should be cleaned up manually if needed
- The change is backward compatible - existing tracking records will continue to work