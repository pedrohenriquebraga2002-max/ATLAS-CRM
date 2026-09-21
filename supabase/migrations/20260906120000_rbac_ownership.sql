-- ============================================================================
-- Isolamento de dados por usuário (ownership por linha)
-- ============================================================================

-- 1) profiles: espelho de auth.users (alvo de FK + fonte do seletor de atribuição)
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

-- 2) helper is_admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- 3) coluna de dono em leads
ALTER TABLE public.leads
  ADD COLUMN owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX idx_leads_owner_id ON public.leads (owner_id);

-- 4) trigger de signup: cria profile + concede papel (primeiro = admin, demais = team)
DROP TRIGGER IF EXISTS on_auth_user_created_grant_admin ON auth.users;
DROP FUNCTION IF EXISTS public.grant_first_user_admin();

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

-- backfill de profiles p/ usuarios ja existentes (idempotente)
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 5) trigger: so admin altera owner_id
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

-- 6) RLS: profiles
CREATE POLICY "Users read own profile or admin reads all" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users update own display_name" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 7) RLS: leads (substitui politicas do time)
DROP POLICY "Anyone can submit a lead" ON public.leads;
DROP POLICY "Team can view leads" ON public.leads;
DROP POLICY "Team can update leads" ON public.leads;
DROP POLICY "Team can delete leads" ON public.leads;

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

-- 8) RLS: lead_notes (escopo herdado do lead pai)
DROP POLICY "Team can view lead notes" ON public.lead_notes;
DROP POLICY "Team can insert lead notes" ON public.lead_notes;
DROP POLICY "Team can delete lead notes" ON public.lead_notes;

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
