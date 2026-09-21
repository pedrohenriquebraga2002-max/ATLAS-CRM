-- ============================================================================
-- SCHEMA BOOTSTRAP — estado final correto do banco (com isolamento por usuário)
-- ============================================================================
-- NÃO é uma migration. Use APENAS para inicializar um Supabase NOVO do zero,
-- colando este arquivo inteiro no SQL Editor de uma única vez.
--
-- Para o projeto que já está no ar (fiuiawsmcmnfrerrmvrm), NÃO rode este
-- arquivo — rode a migration incremental
-- supabase/migrations/20260906120000_rbac_ownership.sql, que leva o banco
-- existente ao mesmo estado final que este script produz num banco vazio.
--
-- Este script equivale a rodar, em ordem, todas as migrations de
-- supabase/migrations/ — as 4 originais + a de RBAC — porém já consolidado,
-- sem criar políticas antigas só para depois removê-las.
-- ============================================================================

-- ─────────────────────────────── Enums ──────────────────────────────────────
CREATE TYPE public.app_role AS ENUM ('admin', 'team');
CREATE TYPE public.lead_status AS ENUM ('novo', 'em_contato', 'qualificado', 'convertido', 'perdido');

-- ─────────────────────────────── user_roles ─────────────────────────────────
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────── Funções de papel ───────────────────────────────
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_team(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','team'))
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_team(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ─────────────────────────────── profiles ───────────────────────────────────
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile or admin reads all" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users update own display_name" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ─────────────────────────────── leads ──────────────────────────────────────
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  country text NOT NULL,
  business_name text,
  segment text NOT NULL,
  revenue_range text,
  would_invest boolean,
  status public.lead_status NOT NULL DEFAULT 'novo',
  source text NOT NULL DEFAULT 'landing_page',
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_leads_created_at ON public.leads (created_at DESC);
CREATE INDEX idx_leads_owner_id ON public.leads (owner_id);

CREATE POLICY "Public can submit unowned lead" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (owner_id IS NULL);
CREATE POLICY "Owner or admin can view lead" ON public.leads
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "Owner or admin can update lead" ON public.leads
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR owner_id = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "Owner or admin can delete lead" ON public.leads
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR owner_id = auth.uid());

-- ─────────────────────────────── lead_notes ─────────────────────────────────
CREATE TABLE public.lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_notes TO authenticated;
GRANT ALL ON public.lead_notes TO service_role;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_lead_notes_lead_id ON public.lead_notes (lead_id, created_at DESC);

CREATE POLICY "View notes of visible leads" ON public.lead_notes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_notes.lead_id
      AND (public.is_admin(auth.uid()) OR l.owner_id = auth.uid())
  ));
CREATE POLICY "Insert notes on visible leads" ON public.lead_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_notes.lead_id
        AND (public.is_admin(auth.uid()) OR l.owner_id = auth.uid())
    )
  );
CREATE POLICY "Delete own notes or admin" ON public.lead_notes
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

-- ─────────────────────────── updated_at trigger ─────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER leads_set_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────── signup: profile + papel (1º = admin) ───────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'team')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ───────────────── só admin altera o dono (owner_id) de um lead ─────────────
CREATE OR REPLACE FUNCTION public.enforce_lead_owner_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Somente admin pode alterar o responsavel de um lead';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_lead_owner_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER leads_enforce_owner_change
  BEFORE UPDATE OF owner_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lead_owner_change();
