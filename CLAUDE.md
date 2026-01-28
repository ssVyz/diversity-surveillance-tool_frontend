# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sequence Diversity Surveillance Tool frontend - a Next.js 14 web application for managing DNA sequences, assays, and primer surveillance with BLAST integration. Built with TypeScript, Tailwind CSS, and Supabase for authentication and database.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Development server (localhost:3000)
npm run build        # Production build
npm start            # Start production server
npm run lint         # Run ESLint
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Architecture

### Tech Stack
- Next.js 14 with App Router
- React 18 with TypeScript 5
- Tailwind CSS 3.3 for styling
- Supabase (PostgreSQL backend, Auth, RPC functions)

### Routing Structure
- `/` - Landing page (public)
- `/login`, `/signup` - Authentication (public)
- `/(authenticated)/` - Protected route group with session check
  - `dashboard/` - Overview with auto-refresh
  - `taxid/` - NCBI taxonomy management
  - `oligo-repository/` - DNA sequence management
  - `assay-repository/` - Assay management with reference amplicons
  - `blast-planner/` - Schedule BLAST alignment jobs
  - `blast-results/` - View job results, export CSV
  - `settings/` - User profile

### Data Flow
```
React Components → Supabase Client (lib/supabase.ts) → Supabase RPC Functions
                                                    → NCBI API (via /api/taxid-lookup)
```

### Key Patterns

**Supabase RPC Calls**: All database operations use Supabase RPC functions, not direct table access:
- `fetch_user_assays()`, `create_user_assay()`, `delete_user_assay()`
- `fetch_user_oligos()`, `create_user_oligo()`, `delete_user_oligo()`
- `fetch_user_taxids()`, `create_user_taxid()`, `delete_user_taxid()`
- `order_dashboard_job()`, `order_blast_aligner_job()`
- `fetch_blast_planning_list()`, `fetch_blast_aligner_jobs()`

**State Management**: React hooks only (useState, useEffect, useCallback, useRef) - no external state libraries.

**Page Caching**: All pages use `export const dynamic = 'force-dynamic'` to disable caching.

**DNA Validation**: Sequences validated against IUPAC codes (A, C, G, T, R, Y, S, W, K, M, B, D, H, V, N).

**File Imports**: Supports FASTA file parsing for bulk import of sequences.

### Authentication
- Supabase Auth with email/password
- Protected routes check session in `(authenticated)/layout.tsx`
- Unauthenticated users redirected to home page
- Auth state managed via `supabase.auth.onAuthStateChange()` listener
