# SplitID — Premium Expense Architecture

SplitID is a modern expense-sharing web application inspired by Splitwise, built using React, TypeScript, Vite, Tailwind CSS, and Supabase. It uses unique, immutable public user IDs (format `SID-XXXXXX`) and searchable usernames instead of phone numbers.

## Features

- **Authentication**: Email/password sign-up and log-in. Custom profile creation on registration with unique `public_id` and searchable `username`.
- **Spaces (Groups)**: Create and edit spaces. Soft-archiving support (prevents hard deletion of data).
- **Ledger & Splits**: Create and edit expenses with three split modes:
  - Equal Split
  - Percentage Split
  - Exact Amount Split
- **Receipt Verification**: Drag and drop receipt uploads (JPG, PNG, PDF) using Supabase Storage.
- **Settle Debts**: Settle balances between members with direct settlement logging.
- **Simplified Balances**: Greedy Debt Simplification engine minimizes the transaction path to settle debts in multiple currencies.
- **Activity Log**: Dedicated audit logs tracking updates and settlements inside each group.
- **UI Aesthetic**: Dark-mode premium glassmorphism, responsive desktop sidebar, and bottom mobile navigation.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide icons
- **Backend**: Supabase Auth, Supabase PostgreSQL, Supabase Storage
- **Security**: PostgreSQL Row Level Security (RLS) policies on all tables

---

## Local Setup Instructions

### 1. Database Migrations
Copy the contents of `supabase_schema.sql` and execute it in your **Supabase Project SQL Editor**. This sets up all tables, triggers, functions, and RLS policies.

### 2. Storage Bucket Configuration
In your Supabase console, go to **Storage**, create a new bucket named `receipts`, and check the **Public** option. (Alternatively, add select/insert policies for authenticated users).

### 3. Environment Variables
The `.env` file is already configured with your live Supabase project credentials:
```env
VITE_SUPABASE_URL=https://cvkoupqtvquruhbfljdy.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_hLmmcLcxa47KPa-_E7LkpQ_0fw_0dXS
```

### 4. Install & Run
Open the project folder in your terminal and run:
```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Build production bundle
npm run build
```
The application will launch on `http://localhost:3000`.
