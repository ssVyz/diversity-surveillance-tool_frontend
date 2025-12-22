# Sequence diversity surveillance tool - Frontend

A Next.js web application for primer sequence surveillance with Supabase authentication.

## Features

- 🔐 User authentication (login/signup)
- ✉️ Email verification via Supabase
- 📊 Database connection status indicator
- 🎨 Modern, responsive UI with Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
   - Copy `.env.local.example` to `.env.local`
   - The Supabase credentials are already configured, but you can update them if needed:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

1. Push your code to GitHub
2. Import your repository in Vercel
3. **IMPORTANT**: Add environment variables in Vercel dashboard (Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://qqjurpkeetxbpqvczdut.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_RrfmZjo63p_3hQdEr6KK1w_eRBTrOVI`
4. Make sure to add these for **Production**, **Preview**, and **Development** environments
5. Redeploy after adding the environment variables

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page with status indicator
│   ├── login/
│   │   └── page.tsx        # Login page
│   └── signup/
│       └── page.tsx        # Signup page
├── lib/
│   └── supabase.ts         # Supabase client configuration
└── public/                 # Static assets
```

## Technologies

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Supabase** - Authentication and database
- **Tailwind CSS** - Styling

