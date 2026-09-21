# Isolamento de dados por usuário (ownership por linha)

Data: 2026-09-06
Status: aprovado para implementação

## Problema

Hoje qualquer usuário autenticado com papel `admin` **ou** `team` (função
`public.is_team()`) enxerga, edita e apaga **todos** os leads e todas as notas.
Não existe noção de "dono" de um lead. O front (`src/routes/_authenticated/crm.tsx`)
faz `supabase.from("leads").select("*")` sem nenhum filtro e depende só do RLS,
que por sua vez é global para o time inteiro.

O que o usuário chamou de "problema de RBAC" é, na prática, ausência de
**isolamento por linha (ownership / multi-tenant)**. Os papéis já existem e
funcionam; falta cada linha ter um dono e as políticas/queries filtrarem por ele.

## Decisões (definidas com o solicitante)

1. **Modelo de posse**: pool + atribuição manual. Todo lead nasce sem dono
   (`owner_id IS NULL` = pool). Somente o **admin** atribui/reatribui leads.
   `team` nunca pega lead do pool sozinho.
2. **Admin vê tudo**: o papel `admin` lê/edita/atribui todos os leads (pool +
   atribuídos). O isolamento vale para o papel `team`.
3. **Dados existentes**: não há dados reais; nenhuma migração de dados é
   necessária.
4. **Camada de reforço**: RLS no Postgres **e** filtro explícito
   `.eq("owner_id", uid)` nas queries do front (defesa em profundidade).
5. **Novos cadastros**: todo signup novo recebe automaticamente o papel `team`
   (o primeiro usuário do sistema continua recebendo `admin`). Sem isso, um
   usuário novo fica sem papel nenhum e não passa no RLS.
6. **Tipos**: `src/integrations/supabase/types.ts` será editado à mão (sem rodar
   `supabase gen types`).

## Abordagem escolhida

Coluna `owner_id` em `leads` + tabela `profiles` (espelho de `auth.users`).

Descartadas:

- **Tabela `lead_assignments` (join)**: auditoria de reatribuição e múltiplos
  donos não são requisitos; join extra em toda query. YAGNI.
- **`owner_id` sem `profiles`**: o admin precisa de uma lista de usuários para o
  seletor de atribuição. `profiles` é a forma padrão no Supabase de expor isso
  sob RLS, em vez de uma RPC `SECURITY DEFINER` lendo `auth.users`.

## Mudança de schema (nova migration)

Arquivo: `supabase/migrations/<timestamp>_rbac_ownership.sql`

### 1. Tabela `profiles`

```sql
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
```

### 2. Helper `is_admin`

```sql
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
```

### 3. Coluna de dono em `leads`

```sql
ALTER TABLE public.leads
  ADD COLUMN owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX idx_leads_owner_id ON public.leads (owner_id);
```

### 4. Trigger de signup (substitui `grant_first_user_admin`)

```sql
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
```

Backfill de `profiles` para usuários já existentes no `auth.users` (idempotente):

```sql
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;
```

### 5. Trigger: só admin altera `owner_id`

```sql
CREATE OR REPLACE FUNCTION public.enforce_lead_owner_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Somente admin pode alterar o responsável de um lead';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_lead_owner_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER leads_enforce_owner_change
  BEFORE UPDATE OF owner_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lead_owner_change();
```

### 6. Substituição das políticas RLS

**`public.profiles`**

```sql
CREATE POLICY "Users read own profile or admin reads all" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users update own display_name" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
```

**`public.leads`** — dropar as políticas atuais (`Team can view/update/delete leads`;
manter `Anyone can submit a lead` mas endurecida) e recriar:

```sql
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
```

Observação: a reatribuição em si é permitida pela política de UPDATE (o admin
satisfaz o `USING`/`WITH CHECK`); a trava fina de "só admin muda `owner_id`" vem
do trigger `leads_enforce_owner_change`. Um `team` pode dar `UPDATE` no próprio
lead mas o trigger bloqueia qualquer tentativa de mexer no `owner_id` (inclusive
devolver para o pool).

**`public.lead_notes`** — escopo herdado do lead pai; `author_id` (já existente)
continua sendo "quem escreveu":

```sql
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
```

**`public.user_roles`** — sem alteração. É o RBAC em si, já tem `user_id` e
políticas de leitura (próprio + admin).

### 7. Limpeza opcional

`public.is_team()` deixa de ser usada pelas políticas. Manter por ora (não
remover na mesma migration para evitar quebra se algo externo depender dela);
anotar como dívida.

## Mudanças de aplicação

### `src/integrations/supabase/types.ts` (edição manual)

- `leads.Row/Insert/Update`: adicionar `owner_id: string | null`.
- Nova entrada `profiles` em `Tables` (Row/Insert/Update + relationship para
  `auth.users` via `id`).
- `leads.Relationships`: adicionar FK `leads_owner_id_fkey` → `profiles.id`.
- `Functions`: adicionar `is_admin: { Args: { _user_id: string }; Returns: boolean }`.

### `src/routes/_authenticated/crm.tsx`

1. **Contexto do usuário** — novo `useQuery(["me"])`:
   - `supabase.auth.getUser()` para o `id`/sessão real;
   - `supabase.from("user_roles").select("role").eq("user_id", uid)` (RLS já
     permite ler o próprio papel) → deriva `isAdmin = roles.includes("admin")`.
2. **`leadsQuery`** passa a depender de `me`:
   - sem sessão real (preview dev com `demo-user`, id não-uuid) → mantém
     `DEMO_LEADS`, sem chamar `.eq`;
   - `isAdmin` → `.select("*")`, com filtro opcional por responsável escolhido
     na UI (`ownerFilter`: `""` = todos, `"pool"` = `.is("owner_id", null)`,
     `<uuid>` = `.eq("owner_id", uuid)`);
   - `team` → `.select("*").eq("owner_id", session.user.id)`.
   - `queryKey` inclui `isAdmin` e `ownerFilter`.
3. **`profilesQuery`** (habilitada só se `isAdmin`):
   `supabase.from("profiles").select("id, email, display_name").order("email")`.
   Alimenta o seletor de atribuição e o filtro "Responsável".
4. **Tipo `Lead`**: adicionar `owner_id: string | null`.
5. **`LeadDialog`**: se `isAdmin`, novo campo "Responsável" (opções: "Pool (sem
   dono)" + cada profile). `onChange` → mutation
   `supabase.from("leads").update({ owner_id: value || null }).eq("id", lead.id)`,
   invalida `["leads"]`, toast. Se não-admin, mostra o responsável como texto
   read-only (para `team` é sempre ele mesmo).
6. **Barra de filtros**: novo `<select>` "Responsável" visível só para `isAdmin`
   (Todos / Pool / cada profile), controlando `ownerFilter`.
7. **`addNote`**: sem mudança estrutural (`author_id` já vem de
   `supabase.auth.getUser()`); o RLS novo cobre o resto.
8. **Header "N leads no funil"**: passa a refletir o escopo do usuário
   naturalmente (a query já vem filtrada).

### `src/components/landing/LeadForm.tsx`

Sem mudança de código. O `insert` não manda `owner_id`; a coluna fica `NULL` e a
política `Public can submit unowned lead` aceita. Confirmar em teste que um
`insert` com `owner_id` preenchido é **rejeitado**.

### Não mexe

- `auth-middleware.ts`, `client.server.ts`, `auth-attacher.ts`, `start.ts`,
  `server.ts`: o CRM é todo client-side; nenhuma server function usa os dados de
  lead hoje.
- `_authenticated/route.tsx`: o `beforeLoad` com `demo-user` continua válido; o
  `crm.tsx` é que passa a tratar o caso "sessão não-real".

## Verificação

Não há infra de testes no projeto (sem `vitest`, sem script `test`).

1. **`supabase/tests/rls.sql`** — script rodável via `psql` contra um Supabase
   local, com `SET request.jwt.claims` simulando cada usuário. Asserts:
   - usuário `team` A **não** vê lead cujo `owner_id` é B;
   - usuário `team` A vê lead cujo `owner_id` é A;
   - `admin` vê leads de A, de B e do pool (`owner_id IS NULL`);
   - `anon` consegue `INSERT` com `owner_id NULL` e **falha** com `owner_id`
     preenchido;
   - `team` A recebe erro ao tentar `UPDATE ... SET owner_id` (trigger);
   - `admin` consegue `UPDATE ... SET owner_id`;
   - notas: A vê/insere nota só em lead visível a A; `DELETE` de nota só do
     próprio autor ou admin.
2. **Checklist manual no CRM** (dois usuários + um admin):
   - login como `team` recém-criado → lista vazia até o admin atribuir;
   - admin atribui um lead → aparece para o `team`, some do pool;
   - `team` muda status e adiciona nota → ok; não vê campo "Responsável"
     editável;
   - `team` não consegue ver lead de outro `team` (nem via filtro/URL);
   - admin vê tudo e o filtro "Responsável" funciona.

## Deploy / troca de instância Supabase (tarefa de infra separada)

A mudança de RBAC é idêntica em qualquer instância. Para apontar o projeto a
outro Supabase:

1. Criar o projeto novo.
2. Definir as 6 vars (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `VITE_SUPABASE_PROJECT_ID`) no `.env` local e no Netlify. Adicionar
   `SUPABASE_SERVICE_ROLE_KEY` no Netlify se algum dia usar `supabaseAdmin`.
3. Atualizar `project_id` em `supabase/config.toml`.
4. Rodar todas as migrations (as 4 atuais + a nova) no projeto novo
   (`supabase db push` ou SQL editor).
5. Primeiro cadastro no banco novo vira `admin` (trigger `handle_new_user`).

Ressalva: o projeto é conectado ao Lovable Cloud (`.lovable/project.json`), que
provisiona o Supabase atual. Um Supabase próprio pode desincronizar os recursos
"Cloud" do Lovable e o Lovable pode tentar reinjetar as env vars dele.

## Ordem de implementação sugerida

1. Migration de schema + RLS + triggers.
2. Backfill de `profiles`.
3. `supabase/tests/rls.sql` e rodar contra Supabase local.
4. Edição manual de `types.ts`.
5. `crm.tsx`: contexto `me` + `isAdmin`.
6. `crm.tsx`: `leadsQuery` role-aware + filtro explícito.
7. `crm.tsx`: `profilesQuery` + campo "Responsável" no `LeadDialog` (admin).
8. `crm.tsx`: filtro "Responsável" na barra (admin).
9. Checklist manual.

## Notas / dívida

- `public.is_team()` fica órfã após esta mudança; remover numa migration futura.
- Não há UI de administração de papéis (promover `team` → `admin`, remover
  acesso). Fora de escopo; hoje se faz direto no banco.
- Sem histórico de reatribuição de leads (só o estado atual de `owner_id`).
