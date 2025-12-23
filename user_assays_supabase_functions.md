# Supabase User Assay Functions - Context for Implementation

## Overview

This document describes three Supabase RPC functions for managing user assays in the primer inclusivity surveillance program. These functions handle creating, fetching, and deleting assays along with their associated reference amplicons.

All functions are `SECURITY DEFINER` functions that use `auth.uid()` for authentication, meaning they work with Supabase's built-in auth system.

---

## Database Schema Context

### `user_assays` table
| Column | Type | Notes |
|--------|------|-------|
| `assay_id` | bigint | Primary key, auto-generated |
| `user_auth` | uuid | Foreign key to auth.users |
| `target_taxid` | bigint | Optional, references taxid_surveillance.entry_id |
| `target_gene` | text | Optional |
| `panel_id` | bigint | Ignored for now |
| `assay_name` | text | Required, unique per user |
| `assay_ref_amplicon` | bigint | Required, references reference_amplicons.amplicon_id |
| `created_at` | timestamptz | Auto-generated |

### `reference_amplicons` table
| Column | Type | Notes |
|--------|------|-------|
| `amplicon_id` | bigint | Primary key, auto-generated |
| `user_auth` | uuid | Foreign key to auth.users |
| `amplicon_name` | text | Optional |
| `amplicon_seq` | text | Required, DNA sequence |
| `created_at` | timestamptz | Auto-generated |

---

## Function 1: `create_user_assay`

Creates a new assay and its associated reference amplicon in a single transaction.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `p_assay_name` | string | Yes | - | Name of the assay. Must be unique per user. |
| `p_amplicon_seq` | string | Yes | - | DNA sequence for the reference amplicon. Must be uppercase IUPAC nucleotide codes only (A,C,G,T,R,Y,S,W,K,M,B,D,H,V,N). No whitespace allowed. |
| `p_target_taxid` | number | No | null | Entry ID from `taxid_surveillance` table. If provided, must exist and belong to the current user. |
| `p_target_gene` | string | No | null | Target gene name. |
| `p_amplicon_name` | string | No | null | Optional name for the reference amplicon. |

### Returns

Returns the created `user_assays` row:
```typescript
{
  assay_id: number;
  user_auth: string;
  target_taxid: number | null;
  target_gene: string | null;
  panel_id: number | null;
  assay_name: string;
  assay_ref_amplicon: number;
  created_at: string;
}
```

### Validation Rules

- User must be authenticated
- `p_assay_name` cannot be empty (whitespace is trimmed)
- `p_assay_name` must be unique for this user (case-sensitive)
- `p_amplicon_seq` cannot be empty
- `p_amplicon_seq` must not contain whitespace
- `p_amplicon_seq` must be ALL CAPS
- `p_amplicon_seq` must only contain valid IUPAC codes: `A`, `C`, `G`, `T`, `R`, `Y`, `S`, `W`, `K`, `M`, `B`, `D`, `H`, `V`, `N`
- If `p_target_taxid` is provided, it must exist in `taxid_surveillance` and belong to the current user

### Example Usage

```typescript
const { data, error } = await supabase.rpc('create_user_assay', {
  p_assay_name: 'My New Assay',
  p_amplicon_seq: 'ATCGATCGATCGATCG',
  p_target_taxid: 123,           // optional
  p_target_gene: 'rpoB',         // optional
  p_amplicon_name: 'rpoB_amp1'   // optional
});

if (error) {
  // Handle error - error.message contains the specific validation error
  console.error(error.message);
} else {
  // data contains the created assay row
  console.log('Created assay:', data.assay_id);
}
```

### Possible Errors

- `'Not authenticated'` - User is not logged in
- `'assay_name must not be empty'`
- `'Assay with name "X" already exists for this user'`
- `'amplicon_seq must not be empty'`
- `'amplicon_seq must not contain whitespace'`
- `'amplicon_seq must be ALL CAPS and contain only A,C,G,T and IUPAC ambiguous codes (R,Y,S,W,K,M,B,D,H,V,N)'`
- `'target_taxid X does not exist'`
- `'target_taxid X does not belong to you'`

---

## Function 2: `fetch_user_assays`

Retrieves all assays belonging to the authenticated user, including the amplicon name from the reference_amplicons table.

### Parameters

None.

### Returns

Returns an array of assay objects:
```typescript
Array<{
  assay_id: number;
  assay_name: string;
  target_taxid: number | null;
  target_gene: string | null;
  assay_ref_amplicon: number;
  amplicon_name: string | null;  // Joined from reference_amplicons
  created_at: string;
}>
```

Results are ordered by `created_at DESC` (newest first).

### Example Usage

```typescript
const { data, error } = await supabase.rpc('fetch_user_assays');

if (error) {
  console.error(error.message);
} else {
  // data is an array of assay objects
  data.forEach(assay => {
    console.log(`${assay.assay_name} (ID: ${assay.assay_id})`);
    console.log(`  Amplicon: ${assay.amplicon_name || 'Unnamed'}`);
    console.log(`  Target taxid: ${assay.target_taxid || 'None'}`);
    console.log(`  Target gene: ${assay.target_gene || 'None'}`);
  });
}
```

### Possible Errors

- `'Not authenticated'` - User is not logged in

---

## Function 3: `delete_user_assay`

Deletes an assay and its associated reference amplicon. Also deletes any oligos linked to this assay.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `p_assay_id` | number | Yes | The ID of the assay to delete |

### Returns

Returns `true` on successful deletion.

### Behavior

1. Verifies the assay exists and belongs to the current user
2. Deletes all oligos associated with this assay (from `user_oligos` table)
3. Deletes the assay from `user_assays`
4. Deletes the associated reference amplicon from `reference_amplicons`

### Example Usage

```typescript
const { data, error } = await supabase.rpc('delete_user_assay', {
  p_assay_id: 42
});

if (error) {
  console.error(error.message);
} else {
  // data === true
  console.log('Assay deleted successfully');
}
```

### Possible Errors

- `'Not authenticated'` - User is not logged in
- `'assay_id X does not exist'`
- `'Not authorized to delete assay_id X'` - Assay belongs to another user

---

## TypeScript Types

```typescript
// Input type for creating an assay
interface CreateAssayInput {
  p_assay_name: string;
  p_amplicon_seq: string;
  p_target_taxid?: number | null;
  p_target_gene?: string | null;
  p_amplicon_name?: string | null;
}

// Return type from create_user_assay
interface UserAssay {
  assay_id: number;
  user_auth: string;
  target_taxid: number | null;
  target_gene: string | null;
  panel_id: number | null;
  assay_name: string;
  assay_ref_amplicon: number;
  created_at: string;
}

// Return type from fetch_user_assays
interface UserAssayWithAmplicon {
  assay_id: number;
  assay_name: string;
  target_taxid: number | null;
  target_gene: string | null;
  assay_ref_amplicon: number;
  amplicon_name: string | null;
  created_at: string;
}

// Input type for deleting an assay
interface DeleteAssayInput {
  p_assay_id: number;
}
```

---

## Client-Side Validation Recommendations

Before calling `create_user_assay`, validate the amplicon sequence on the client side:

```typescript
function isValidAmpliconSequence(seq: string): boolean {
  if (!seq || seq.trim() === '') return false;
  if (/\s/.test(seq)) return false;  // no whitespace
  return /^[ACGTRYSWKMBDHVN]+$/.test(seq);
}

function formatAmpliconSequence(seq: string): string {
  // Remove whitespace and convert to uppercase
  return seq.replace(/\s/g, '').toUpperCase();
}
```

---

## Related Existing Functions

These assay functions work alongside existing functions in the database:

- `fetch_user_taxids()` - Get user's taxid entries (for populating target_taxid dropdown)
- `create_user_taxid(p_taxid, p_taxid_spec)` - Create new taxid entry
- `delete_user_taxid(p_entry_id)` - Delete taxid entry
- `fetch_user_oligos()` - Get user's oligos (includes assay_id reference)
- `create_user_oligo(p_sequence_name, p_dna_sequence, p_assay_id, p_panel_id)` - Create oligo linked to an assay
- `delete_user_oligo(p_oligo_id)` - Delete an oligo

---

## Implementation Notes

1. **Authentication**: All functions require the user to be authenticated via Supabase Auth. Ensure `supabase.auth.getUser()` returns a valid user before calling these functions.

2. **Error Handling**: The functions throw descriptive exceptions. Always wrap RPC calls in try-catch or check the `error` property of the response.

3. **Cascade Behavior**: When deleting an assay, associated oligos and the reference amplicon are automatically deleted. Warn users about this in the UI.

4. **Amplicon Sequence**: The sequence validation is strict. Consider adding a client-side formatter that removes whitespace and converts to uppercase before submission.

5. **Target Taxid**: When building a form, fetch the user's taxids using `fetch_user_taxids()` to populate a dropdown for the optional `target_taxid` field.
