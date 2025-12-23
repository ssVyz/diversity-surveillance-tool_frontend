# Cursor Context: Implement `oligo_change_assay` Function

## Overview

Implement a feature that allows users to change the assay assignment for an oligo entry. This involves calling a Supabase RPC function and updating the UI accordingly.

---

## Database Function Details

### Function Name
`oligo_change_assay`

### Purpose
Changes the `assay_id` for a given oligo in the `user_oligos` table. The function validates that both the oligo and the target assay belong to the authenticated user before making any changes.

### Function Signature
```sql
oligo_change_assay(p_oligo_id: bigint, p_assay_id: bigint | null) → user_oligos
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `p_oligo_id` | `bigint` | Yes | The ID of the oligo to update (from `user_oligos.oligo_id`) |
| `p_assay_id` | `bigint` | No | The ID of the assay to assign (from `user_assays.assay_id`). Pass `null` to unassign the oligo from any assay. |

### Return Value
Returns the updated `user_oligos` row with the following structure:
```typescript
interface UserOligo {
  oligo_id: number;
  user_auth: string;        // UUID
  sequence_name: string;
  dna_sequence: string;
  created_at: string;       // ISO timestamp
  assay_id: number | null;
  panel_id: number | null;
}
```

### Error Cases
The function will throw an error (which Supabase returns as an error response) in these cases:

| Error Message | Cause |
|---------------|-------|
| `"Not authenticated"` | User is not logged in |
| `"oligo_id must not be null"` | `p_oligo_id` was not provided |
| `"oligo_id X does not exist"` | No oligo found with the given ID |
| `"oligo_id X does not belong to you"` | The oligo exists but belongs to another user |
| `"assay_id X does not exist"` | No assay found with the given ID |
| `"assay_id X does not belong to you"` | The assay exists but belongs to another user |

---

## Implementation Guide

### Calling the Function via Supabase Client

```typescript
import { createClient } from '@/utils/supabase/client'; // or your supabase client path

async function changeOligoAssay(oligoId: number, assayId: number | null) {
  const supabase = createClient();
  
  const { data, error } = await supabase.rpc('oligo_change_assay', {
    p_oligo_id: oligoId,
    p_assay_id: assayId
  });

  if (error) {
    throw new Error(error.message);
  }

  return data; // Returns the updated user_oligos row
}
```

### Server Action Example (Next.js App Router)

```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function changeOligoAssayAction(oligoId: number, assayId: number | null) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('oligo_change_assay', {
    p_oligo_id: oligoId,
    p_assay_id: assayId
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/oligos'); // Adjust path as needed
  return { success: true, data };
}
```

### TypeScript Types

```typescript
// Add to your types file
interface ChangeOligoAssayParams {
  p_oligo_id: number;
  p_assay_id: number | null;
}

// For the Supabase client type extensions (if using generated types)
// The RPC function returns a single user_oligos row
```

---

## UI/UX Recommendations

### Suggested UI Patterns

1. **Dropdown/Select Component**: Show a dropdown of user's assays when editing an oligo, with an option for "No Assay" (null).

2. **Inline Edit**: Allow clicking on the assay name in an oligos table to trigger a dropdown for quick reassignment.

3. **Bulk Operations**: Consider allowing users to select multiple oligos and assign them to an assay at once (would require multiple RPC calls or a separate bulk function).

### User Flow Example
1. User views their oligos list/table
2. User clicks "Edit" or clicks on the assay field for an oligo
3. A dropdown appears showing all user's assays (fetched via `fetch_user_assays`)
4. User selects a new assay (or "None")
5. On selection, call `oligo_change_assay`
6. Show success/error toast notification
7. Update the UI to reflect the change

### Loading & Error States
- Show loading spinner/disabled state while the RPC call is in progress
- Display error messages from the function (they are user-friendly)
- Optimistically update the UI if desired, with rollback on error

---

## Related Functions & Tables

### Tables Involved
- `user_oligos` — stores oligo entries (being updated)
- `user_assays` — stores assay entries (referenced by assay_id)

### Related RPC Functions You May Need
- `fetch_user_oligos()` — Get all oligos for the current user
- `fetch_user_assays()` — Get all assays for the current user (for populating dropdowns)
- `create_user_oligo(...)` — Create a new oligo
- `delete_user_oligo(p_oligo_id)` — Delete an oligo

---

## Example Component Snippet

```tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

interface AssaySelectProps {
  oligoId: number;
  currentAssayId: number | null;
  assays: Array<{ assay_id: number; assay_name: string }>;
  onSuccess?: () => void;
}

export function AssaySelect({ oligoId, currentAssayId, assays, onSuccess }: AssaySelectProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newAssayId = e.target.value === '' ? null : Number(e.target.value);
    
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('oligo_change_assay', {
      p_oligo_id: oligoId,
      p_assay_id: newAssayId
    });

    setLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    onSuccess?.();
  }

  return (
    <div>
      <select
        value={currentAssayId ?? ''}
        onChange={handleChange}
        disabled={loading}
      >
        <option value="">No Assay</option>
        {assays.map((assay) => (
          <option key={assay.assay_id} value={assay.assay_id}>
            {assay.assay_name}
          </option>
        ))}
      </select>
      {loading && <span>Saving...</span>}
      {error && <span className="text-red-500">{error}</span>}
    </div>
  );
}
```

---

## Testing Checklist

- [ ] Can change an oligo's assay to a different assay owned by the user
- [ ] Can unassign an oligo from an assay (set to null)
- [ ] Error is shown when trying to assign to an assay that doesn't exist
- [ ] Error is shown when trying to assign to another user's assay
- [ ] Error is shown when trying to modify another user's oligo
- [ ] UI updates correctly after successful change
- [ ] Loading state is displayed during the operation
