-- SQL Setup script for SplitID Expense Sharing
-- Paste this into your Supabase SQL Editor.

-- 1. Drop trigger on auth.users (which always exists in Supabase)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop tables if they exist (CASCADE automatically drops triggers, indexes, and constraints associated with them)
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.settlements CASCADE;
DROP TABLE IF EXISTS public.expense_splits CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 3. Drop functions if they exist
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.generate_public_id() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_immutable_public_id() CASCADE;
DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Create updated_at automatic update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. PROFILES Table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    public_id TEXT NOT NULL UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. GROUPS Table
CREATE TABLE public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_groups_updated_at
BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. GROUP MEMBERS Table
CREATE TABLE public.group_members (
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, profile_id)
);

CREATE TRIGGER update_group_members_updated_at
BEFORE UPDATE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. EXPENSES Table
CREATE TABLE public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    paid_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes TEXT,
    receipt_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. EXPENSE SPLITS Table
CREATE TABLE public.expense_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    percentage NUMERIC(5,2) CHECK (percentage >= 0 AND percentage <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_expense_profile_split UNIQUE(expense_id, profile_id)
);

CREATE TRIGGER update_expense_splits_updated_at
BEFORE UPDATE ON public.expense_splits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. SETTLEMENTS Table
CREATE TABLE public.settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    payer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    payee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT payer_payee_different CHECK (payer_id <> payee_id)
);

CREATE TRIGGER update_settlements_updated_at
BEFORE UPDATE ON public.settlements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. ACTIVITY LOGS Table
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public ID Generator Trigger
CREATE OR REPLACE FUNCTION public.generate_public_id()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT;
    i INTEGER;
    exists_already BOOLEAN;
BEGIN
    LOOP
        result := 'SID-';
        FOR i IN 1..6 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        END LOOP;
        
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE public_id = result) INTO exists_already;
        IF NOT exists_already THEN
            RETURN result;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;

-- Handle user signup profile generation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    generated_uname TEXT;
    base_uname TEXT;
    uname_counter INTEGER := 0;
    uname_exists BOOLEAN;
BEGIN
    -- Derive username
    base_uname := COALESCE(
        NEW.raw_user_meta_data->>'username',
        SPLIT_PART(NEW.email, '@', 1),
        'user'
    );
    
    generated_uname := base_uname;
    
    LOOP
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = generated_uname) INTO uname_exists;
        IF NOT uname_exists THEN
            EXIT;
        END IF;
        uname_counter := uname_counter + 1;
        generated_uname := base_uname || uname_counter::TEXT;
    END LOOP;

    INSERT INTO public.profiles (id, name, email, username, public_id, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', generated_uname),
        NEW.email,
        generated_uname,
        public.generate_public_id(),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for auth.users creation
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to make public_id immutable
CREATE OR REPLACE FUNCTION public.enforce_immutable_public_id()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.public_id IS DISTINCT FROM NEW.public_id THEN
        RAISE EXCEPTION 'Field public_id is immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER check_profiles_public_id_immutable
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_public_id();


-- Helper function to check group membership (bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_group_member(group_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_members.group_id = $1
        AND group_members.profile_id = $2
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Row Level Security Configuration
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Profiles are viewable by authenticated users"
    ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Groups Policies
CREATE POLICY "Groups are viewable by group members"
    ON public.groups FOR SELECT TO authenticated USING (
        created_by = auth.uid()
        OR
        public.is_group_member(id, auth.uid())
    );

CREATE POLICY "Any authenticated user can create groups"
    ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group members can update groups"
    ON public.groups FOR UPDATE TO authenticated USING (
        public.is_group_member(id, auth.uid())
    );

-- Group Members Policies
CREATE POLICY "Members can view group membership"
    ON public.group_members FOR SELECT TO authenticated USING (
        profile_id = auth.uid()
        OR
        public.is_group_member(group_id, auth.uid())
    );

CREATE POLICY "Members can add members to a group"
    ON public.group_members FOR INSERT TO authenticated WITH CHECK (
        public.is_group_member(group_id, auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM public.groups
            WHERE groups.id = group_members.group_id
            AND groups.created_by = auth.uid()
        )
    );

CREATE POLICY "Members can leave or be removed"
    ON public.group_members FOR DELETE TO authenticated USING (
        profile_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.groups
            WHERE groups.id = group_members.group_id
            AND groups.created_by = auth.uid()
        )
    );

-- Expenses Policies
CREATE POLICY "Expenses viewable by members"
    ON public.expenses FOR SELECT TO authenticated USING (
        public.is_group_member(group_id, auth.uid())
    );

CREATE POLICY "Expenses insertable by members"
    ON public.expenses FOR INSERT TO authenticated WITH CHECK (
        public.is_group_member(group_id, auth.uid())
        AND paid_by = auth.uid()
    );

CREATE POLICY "Expenses updatable by members"
    ON public.expenses FOR UPDATE TO authenticated USING (
        public.is_group_member(group_id, auth.uid())
    );

CREATE POLICY "Expenses deletable by members"
    ON public.expenses FOR DELETE TO authenticated USING (
        public.is_group_member(group_id, auth.uid())
    );

-- Splits Policies
CREATE POLICY "Splits viewable by members"
    ON public.expense_splits FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.expenses
            WHERE expenses.id = expense_splits.expense_id
            AND public.is_group_member(expenses.group_id, auth.uid())
        )
    );

CREATE POLICY "Splits insertable by members"
    ON public.expense_splits FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.expenses
            WHERE expenses.id = expense_splits.expense_id
            AND public.is_group_member(expenses.group_id, auth.uid())
        )
    );

CREATE POLICY "Splits updatable by members"
    ON public.expense_splits FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.expenses
            WHERE expenses.id = expense_splits.expense_id
            AND public.is_group_member(expenses.group_id, auth.uid())
        )
    );

CREATE POLICY "Splits deletable by members"
    ON public.expense_splits FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.expenses
            WHERE expenses.id = expense_splits.expense_id
            AND public.is_group_member(expenses.group_id, auth.uid())
        )
    );

-- Settlements Policies
CREATE POLICY "Settlements viewable by members"
    ON public.settlements FOR SELECT TO authenticated USING (
        public.is_group_member(group_id, auth.uid())
    );

CREATE POLICY "Settlements insertable by members"
    ON public.settlements FOR INSERT TO authenticated WITH CHECK (
        public.is_group_member(group_id, auth.uid())
        AND payer_id = auth.uid()
    );

CREATE POLICY "Settlements deletable by members"
    ON public.settlements FOR DELETE TO authenticated USING (
        public.is_group_member(group_id, auth.uid())
    );

-- Activity Logs Policies
CREATE POLICY "Activity logs viewable by members"
    ON public.activity_logs FOR SELECT TO authenticated USING (
        public.is_group_member(group_id, auth.uid())
    );

CREATE POLICY "Activity logs insertable by members"
    ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (
        public.is_group_member(group_id, auth.uid())
        AND actor_id = auth.uid()
    );
