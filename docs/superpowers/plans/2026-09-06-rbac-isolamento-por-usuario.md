# Isolamento de dados por usuário — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada lead passa a ter um dono (`owner_id`); usuários `team` só enxergam/editam os leads atribuídos a eles, `admin` enxerga tudo e é o único que atribui.

**Architecture:** Coluna `owner_id` nullable em `leads` (`NULL` = pool). Tabela `profiles` (espelho de `auth.users`) como alvo de FK e fonte do seletor de atribuição do admin. Isolamento imposto por RLS no Postgres (`is_admin(uid) OR owner_id = uid`) e reforçado por filtro explícito `.eq("owner_id", uid)` nas queries do CRM. Trigger de signup passa a criar `profile` + conceder papel `team` a todo novo usuário (o primeiro continua `admin`). Trigger `BEFORE UPDATE OF owner_id` bloqueia qualquer alteração de dono feita por não-admin.

**Tech Stack:** Postgres/Supabase (RLS, triggers, funções `SECURITY DEFINER`), TanStack Start + React 19, `@tanstack/react-query`, `@supabase/supabase-js`.

**Spec:** `docs/superpowers/specs/2026-09-06-rbac-isolamento-por-usuario-design.md`

## Status de execução (2026-09-06 — inline nesta sessão)

Todo o trabalho de **código** foi feito e validado (`npx tsc --noEmit` limpo, `npm run build` OK).
Restam os passos que dependem do painel do Supabase e de contas reais.

| Task | Estado |
|---|---|
| 1 — Migration | Arquivo escrito ✅ · **falta**: aplicar no SQL Editor + rodar os SELECTs de verificação |
| 2 — Script de RLS | `scripts/verify-rls.mjs` escrito ✅ · **falta**: criar `.env.local` com `SUPABASE_SERVICE_ROLE_KEY` e rodar o script |
| 3 — `types.ts` | Concluído ✅ (`owner_id`, `profiles`, `is_admin`, FK) |
| 4 — Contexto `me`/`isAdmin` | Concluído ✅ |
| 5 — `leadsQuery` por dono + `ownerFilter` | Concluído ✅ (fallback `DEMO_LEADS` só sem sessão real; `EMPTY_LEADS` estável para não invalidar o `useMemo`) |
| 6 — Atribuição no `LeadDialog` (admin) | Concluído ✅ (`profilesQuery`, `assignOwner`, campo "Responsável") |
| 7 — Filtro "Responsável" na barra (admin) | Concluído ✅ |
| 8 — Verificação final | `tsc` + `build` OK ✅ · `npm run lint` tem ~367 erros **de prettier pré-existentes** em todo o repo (não é regressão) · **falta**: re-rodar o script de RLS + checklist manual com 1 admin + 2 `team` |

**Extra entregue:** `supabase/schema-bootstrap.sql` — estado final consolidado do banco, para inicializar um Supabase **novo** do zero numa única colagem (não é migration; não rodar no projeto atual).

## Global Constraints

- **Somente `admin` altera `owner_id`.** `team` nunca reatribui um lead nem o devolve ao pool.
- **`admin` vê todos os leads** (pool + atribuídos); o isolamento vale para o papel `team`.
- **RLS é a fonte de verdade.** Os filtros no cliente são defesa em profundidade, nunca a única barreira.
- **Novos signups recebem papel `team`** automaticamente; o primeiro usuário do sistema continua recebendo `admin`.
- **Sem migração de dados** — não há dados reais na base.
- **Tipos editados à mão** em `src/integrations/supabase/types.ts` — não rodar `supabase gen types`.
- **Migrations aplicadas pelo SQL editor do Supabase** — não há `supabase` CLI nem `psql` local.
- **Não adicionar test runner.** Verificação de RLS por script Node usando `@supabase/supabase-js` (já é dependência). Verificação de front por `tsc`, `eslint` e checklist manual.
- **Projeto não é repositório git local.** Os passos de "commit" são opcionais: execute apenas se houver `git init` / fluxo Lovable ativo. Nunca reescrever histórico publicado (ver `AGENTS.md`).
- **Idioma:** toda UI e mensagem ao usuário em Português (pt-BR), com acentuação correta.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/20260906120000_rbac_ownership.sql` | Criar | Schema: `profiles`, `is_admin()`, `leads.owner_id`, trigger `handle_new_user`, trigger `enforce_lead_owner_change`, substituição de todas as políticas RLS de `leads`/`lead_notes`/`profiles`. |
| `scripts/verify-rls.mjs` | Criar | Verificação automatizada de RLS: cria usuários descartáveis via service role, exercita cada política com clientes autenticados distintos, faz asserts e limpa. |
| `.env.local` | Criar (git-ignorado por `*.local`) | Guardar `SUPABASE_SERVICE_ROLE_KEY` para o script de verificação. Não commitar. |
| `src/integrations/supabase/types.ts` | Modificar | Adicionar `owner_id` em `leads`, tabela `profiles`, função `is_admin`, relationship `leads_owner_id_fkey`. |
| `src/routes/_authenticated/crm.tsx` | Modificar | Contexto do usuário (`me` + `isAdmin`), `leadsQuery` role-aware + filtro explícito, `profilesQuery`, campo "Responsável" no `LeadDialog`, filtro "Responsável" na barra (admin). |

Nada muda em `LeadForm.tsx`, `client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `start.ts`, `server.ts`, `_authenticated/route.tsx`.

---

## Task 1: Migration de schema, triggers e RLS

**Files:**
- Create: `supabase/migrations/20260906120000_rbac_ownership.sql`

**Interfaces:**
- Produces (para uso do front e das tasks seguintes):
  - Tabela `public.profiles`: colunas `id uuid` (PK, FK → `auth.users.id`), `email text NOT NULL`, `display_name text NULL`, `created_at timestamptz`.
  - Coluna `public.leads.owner_id uuid NULL` (FK → `public.profiles.id`, `ON DELETE SET NULL`).
  - Função `public.is_admin(_user_id uuid) RETURNS boolean`.
  - Regra: `INSERT` em `leads` só é aceito com `owner_id IS NULL` (anon e authenticated).
  - Regra: `UPDATE` de `leads.owner_id` por não-admin gera exceção.

- [x] **Step 1: Escrever a migration**

Criar `supabase/migrations/20260906120000_rbac_ownership.sql` com exatamente este conteúdo:

```sql
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
```

- [ ] **Step 2: Aplicar a migration**

No painel do Supabase do projeto (`fiuiawsmcmnfrerrmvrm`): **SQL Editor → New query →** colar o conteúdo do arquivo → **Run**.
Esperado: execução sem erro ("Success. No rows returned").

- [ ] **Step 3: Verificar a estrutura**

Ainda no SQL Editor, rodar:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'owner_id';

SELECT to_regclass('public.profiles') AS profiles_table;

SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace AND proname IN ('is_admin','handle_new_user','enforce_lead_owner_change');

SELECT polname FROM pg_policy
WHERE polrelid = 'public.leads'::regclass;
```

Esperado:
- `owner_id` retorna 1 linha;
- `profiles_table` = `profiles`;
- as 3 funções aparecem;
- políticas de `leads`: `Public can submit unowned lead`, `Owner or admin can view lead`, `Owner or admin can update lead`, `Owner or admin can delete lead` (e nenhuma `Team can ...`).

- [ ] **Step 4: Commit (opcional — ver Global Constraints)**

```bash
git add supabase/migrations/20260906120000_rbac_ownership.sql
git commit -m "feat(db): ownership por linha em leads (owner_id, RLS, triggers)"
```

---

## Task 2: Script de verificação de RLS

**Files:**
- Create: `scripts/verify-rls.mjs`
- Create: `.env.local` (git-ignorado)

**Interfaces:**
- Consumes: schema/políticas da Task 1; `@supabase/supabase-js` (já em `package.json`).
- Produces: comando `node --env-file=.env --env-file=.env.local scripts/verify-rls.mjs` que sai com código `0` se todas as políticas se comportam como especificado, `1` caso contrário.

- [ ] **Step 1: Preparar `.env.local`**

No painel do Supabase: **Project Settings → API → `service_role` secret**. Criar `/.env.local` com:

```
SUPABASE_SERVICE_ROLE_KEY=<cole aqui o service_role secret>
```

Confirmar que está git-ignorado:

```bash
git check-ignore .env.local && echo "ignorado OK"
```

(Se o projeto não for git, pular esta confirmação — `.gitignore` já cobre `*.local`.)

- [x] **Step 2: Escrever o script (o "teste que falha")**

Criar `scripts/verify-rls.mjs` com exatamente este conteúdo:

```js
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error(
    "Faltam variáveis: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_PUBLISHABLE_KEY",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const ts = Date.now();
const pw = "Test123456!";
let failures = 0;
const created = [];

const check = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
};

const mkUser = async (tag) => {
  const email = `rls-${tag}-${ts}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: pw,
    email_confirm: true,
  });
  if (error) throw error;
  created.push(data.user.id);
  return { id: data.user.id, email };
};

const asUser = async (email) => {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: pw });
  if (error) throw error;
  return c;
};

const leadFixture = (name) => ({
  name,
  email: `${name}@x.com`,
  phone: "+1 000",
  country: "Estados Unidos",
  segment: "E-commerce",
});

try {
  const userA = await mkUser("a");
  const userB = await mkUser("b");
  const userAdmin = await mkUser("admin");
  const { error: promoteErr } = await admin
    .from("user_roles")
    .insert({ user_id: userAdmin.id, role: "admin" });
  if (promoteErr) throw promoteErr;

  const cA = await asUser(userA.email);
  const cB = await asUser(userB.email);
  const cAdmin = await asUser(userAdmin.email);
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });

  // anon insere lead sem dono
  const { data: pubLead, error: pubErr } = await anon
    .from("leads")
    .insert(leadFixture("pub"))
    .select("id")
    .single();
  check("anon insere lead com owner_id NULL", !pubErr && !!pubLead?.id);

  // anon NAO insere lead com owner_id preenchido
  const { error: pubOwnErr } = await anon
    .from("leads")
    .insert({ ...leadFixture("pub2"), owner_id: userA.id });
  check("anon NAO insere lead com owner_id preenchido", !!pubOwnErr);

  // admin atribui o lead do pool para A
  const { error: assignErr } = await cAdmin
    .from("leads")
    .update({ owner_id: userA.id })
    .eq("id", pubLead.id);
  check("admin atribui owner_id", !assignErr);

  // A ve / B NAO ve / admin ve
  const { data: aSees } = await cA.from("leads").select("id").eq("id", pubLead.id);
  check("team A ve lead atribuido a A", aSees?.length === 1);

  const { data: bSees } = await cB.from("leads").select("id").eq("id", pubLead.id);
  check("team B NAO ve lead de A", (bSees?.length ?? 0) === 0);

  const { data: adminSees } = await cAdmin
    .from("leads")
    .select("id")
    .eq("id", pubLead.id);
  check("admin ve lead de A", adminSees?.length === 1);

  // A NAO reatribui (trigger) e NAO devolve ao pool
  const { error: aReassignErr } = await cA
    .from("leads")
    .update({ owner_id: userB.id })
    .eq("id", pubLead.id);
  check("team A NAO reatribui lead (trigger bloqueia)", !!aReassignErr);

  const { error: aPoolErr } = await cA
    .from("leads")
    .update({ owner_id: null })
    .eq("id", pubLead.id);
  check("team A NAO devolve lead ao pool", !!aPoolErr);

  // A atualiza status do proprio lead (permitido)
  const { error: aStatusErr } = await cA
    .from("leads")
    .update({ status: "em_contato" })
    .eq("id", pubLead.id);
  check("team A atualiza status do proprio lead", !aStatusErr);

  // notas
  const { error: aNoteErr } = await cA
    .from("lead_notes")
    .insert({ lead_id: pubLead.id, body: "nota A", author_id: userA.id });
  check("team A insere nota em lead visivel", !aNoteErr);

  const { data: bNotes } = await cB
    .from("lead_notes")
    .select("id")
    .eq("lead_id", pubLead.id);
  check("team B NAO ve notas do lead de A", (bNotes?.length ?? 0) === 0);

  const { error: bNoteErr } = await cB
    .from("lead_notes")
    .insert({ lead_id: pubLead.id, body: "x", author_id: userB.id });
  check("team B NAO insere nota em lead de A", !!bNoteErr);

  // profiles
  const { data: aProfiles } = await cA.from("profiles").select("id");
  check(
    "team A so enxerga o proprio profile",
    aProfiles?.length === 1 && aProfiles[0].id === userA.id,
  );

  const { data: adminProfiles } = await cAdmin.from("profiles").select("id");
  check("admin enxerga varios profiles", (adminProfiles?.length ?? 0) >= 3);

  // cleanup do lead
  await admin.from("leads").delete().eq("id", pubLead.id);
} finally {
  for (const id of created) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

console.log(
  failures === 0
    ? "\nTODOS OS TESTES DE RLS PASSARAM"
    : `\n${failures} FALHA(S) DE RLS`,
);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 3: Rodar o script**

```bash
node --env-file=.env --env-file=.env.local scripts/verify-rls.mjs
```

Esperado: todas as linhas `PASS` e `TODOS OS TESTES DE RLS PASSARAM`, código de saída `0`.

- [ ] **Step 4: Se algum `FAIL` — corrigir a migration**

Ajustar `supabase/migrations/20260906120000_rbac_ownership.sql`, reaplicar no SQL Editor (as políticas usam `CREATE POLICY`; para reaplicar, primeiro `DROP POLICY "<nome>" ON public.<tabela>;` a política afetada) e rodar o script de novo até tudo passar.

- [ ] **Step 5: Commit (opcional)**

```bash
git add scripts/verify-rls.mjs
git commit -m "test(db): script de verificacao de RLS por usuario"
```

---

## Task 3: Atualizar os tipos gerados (edição manual)

**Files:**
- Modify: `src/integrations/supabase/types.ts`

**Interfaces:**
- Consumes: schema da Task 1.
- Produces (para o `crm.tsx`):
  - `Database["public"]["Tables"]["leads"]["Row"].owner_id: string | null`
  - `Database["public"]["Tables"]["profiles"]["Row"]: { id: string; email: string; display_name: string | null; created_at: string }`
  - `Database["public"]["Functions"]["is_admin"]`

- [x] **Step 1: Adicionar `owner_id` em `leads` (Row, Insert, Update)**

Em `src/integrations/supabase/types.ts`, dentro de `Tables.leads`:
- `Row`: adicionar a linha `owner_id: string | null` (em ordem alfabética, entre `notes` e `phone`).
- `Insert`: adicionar `owner_id?: string | null`.
- `Update`: adicionar `owner_id?: string | null`.

Em `Tables.leads.Relationships` (hoje `[]`), passar para:

```ts
        Relationships: [
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
```

- [x] **Step 2: Adicionar a tabela `profiles`**

Dentro de `Database["public"]["Tables"]`, adicionar a entrada (manter as chaves em ordem: `lead_notes`, `leads`, `profiles`, `user_roles`):

```ts
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
```

- [x] **Step 3: Adicionar a função `is_admin`**

Em `Database["public"]["Functions"]`, junto de `has_role` e `is_team`:

```ts
      is_admin: { Args: { _user_id: string }; Returns: boolean }
```

- [x] **Step 4: Checar tipos**

```bash
npx tsc --noEmit
```

Esperado: sem erros (mesmo baseline de antes da mudança).

- [ ] **Step 5: Commit (opcional)**

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore(types): owner_id, tabela profiles e is_admin"
```

---

## Task 4: Contexto do usuário (`me` + `isAdmin`) no CRM

**Files:**
- Modify: `src/routes/_authenticated/crm.tsx`

**Interfaces:**
- Consumes: tipos da Task 3; `supabase` de `@/integrations/supabase/client`.
- Produces (dentro de `CrmPage`): objeto
  `me: { userId: string | null; isAdmin: boolean; isReal: boolean }` e `meQuery`
  (`useQuery`), consumidos pelas Tasks 5–7.

- [x] **Step 1: Adicionar o tipo `Profile` e a query `me`**

No topo de `crm.tsx`, junto dos outros `type` (após `type Note = ...`):

```ts
type Profile = { id: string; email: string; display_name: string | null };
type Me = { userId: string | null; isAdmin: boolean; isReal: boolean };
```

Dentro de `CrmPage`, logo após `const queryClient = useQueryClient();`, adicionar:

```ts
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { userId: null, isAdmin: false, isReal: false };
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      return { userId: user.id, isAdmin, isReal: true };
    },
  });
  const me: Me = meQuery.data ?? { userId: null, isAdmin: false, isReal: false };
```

- [x] **Step 2: Checar tipos e build**

```bash
npx tsc --noEmit && npm run build
```

Esperado: build conclui sem erro. (`me` ainda não é usado — aceitável neste passo; se o `eslint` do build reclamar de variável não usada, seguir para a Task 5 que a consome e revalidar lá.)

- [ ] **Step 3: Commit (opcional)**

```bash
git add src/routes/_authenticated/crm.tsx
git commit -m "feat(crm): contexto do usuario (me + isAdmin)"
```

---

## Task 5: `leadsQuery` role-aware + filtro explícito por dono

**Files:**
- Modify: `src/routes/_authenticated/crm.tsx`

**Interfaces:**
- Consumes: `me` / `meQuery` da Task 4.
- Produces: estado `ownerFilter` (`string`: `""` = todos, `"pool"` = sem dono, `<uuid>` = usuário) e `setOwnerFilter`, consumidos pela Task 7. `leadsQuery` passa a depender de `me` e `ownerFilter`.

- [x] **Step 1: Adicionar `owner_id` ao tipo local `Lead`**

Em `crm.tsx`, no `type Lead = { ... }`, adicionar após `status: LeadStatus;`:

```ts
  owner_id: string | null;
```

Nos 5 objetos de `DEMO_LEADS`, adicionar `owner_id: null,` em cada um (após `status: "..."`).

- [x] **Step 2: Adicionar o estado `ownerFilter`**

Junto dos outros `useState` de filtro (após `const [status, setStatus] = useState("");`):

```ts
  const [ownerFilter, setOwnerFilter] = useState<string>(""); // "" | "pool" | uuid
```

- [x] **Step 3: Substituir a `leadsQuery`**

Trocar o bloco atual `const leadsQuery = useQuery({ queryKey: ["leads"], ... })` por:

```ts
  const leadsQuery = useQuery({
    queryKey: ["leads", me.userId, me.isAdmin, ownerFilter],
    enabled: !meQuery.isLoading,
    queryFn: async () => {
      if (!me.isReal) return [] as Lead[]; // preview local sem sessao -> DEMO_LEADS
      let q = supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (me.isAdmin) {
        if (ownerFilter === "pool") q = q.is("owner_id", null);
        else if (ownerFilter) q = q.eq("owner_id", ownerFilter);
      } else {
        q = q.eq("owner_id", me.userId as string);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });
```

- [x] **Step 4: Corrigir o fallback de `DEMO_LEADS`**

Trocar:

```ts
  const leads = (leadsQuery.data && leadsQuery.data.length > 0)
    ? leadsQuery.data
    : DEMO_LEADS;
```

por:

```ts
  const leads =
    !me.isReal && (!leadsQuery.data || leadsQuery.data.length === 0)
      ? DEMO_LEADS
      : (leadsQuery.data ?? []);
```

(Assim um usuário `team` real sem leads atribuídos vê uma lista vazia, não os dados de demonstração.)

- [x] **Step 5: Ajustar o gate de loading**

Trocar `{leadsQuery.isLoading ? (` por `{meQuery.isLoading || leadsQuery.isLoading ? (`.

- [x] **Step 6: Checar tipos e build**

```bash
npx tsc --noEmit && npm run build
```

Esperado: sem erros.

- [ ] **Step 7: Verificação manual rápida**

`npm run dev`, abrir `/crm` sem estar logado (preview local): a lista de demonstração ainda aparece. (Verificação com usuários reais fica na Task 8.)

- [ ] **Step 8: Commit (opcional)**

```bash
git add src/routes/_authenticated/crm.tsx
git commit -m "feat(crm): leadsQuery filtra por dono (RLS + filtro explicito)"
```

---

## Task 6: Atribuição de responsável no `LeadDialog` (admin)

**Files:**
- Modify: `src/routes/_authenticated/crm.tsx`

**Interfaces:**
- Consumes: `me` (Task 4), `Profile` (Task 4), `assignOwner` mutation (definida aqui).
- Produces: `profilesQuery` (`useQuery`, habilitada só para admin) reutilizada pela Task 7; prop nova de `LeadDialog`.

- [x] **Step 1: Adicionar `profilesQuery` e a mutation `assignOwner`**

Dentro de `CrmPage`, após `updateStatus`:

```ts
  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    enabled: me.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .order("email");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const assignOwner = useMutation({
    mutationFn: async ({ id, ownerId }: { id: string; ownerId: string | null }) => {
      const { error } = await supabase
        .from("leads")
        .update({ owner_id: ownerId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Responsável atualizado");
    },
    onError: () => toast.error("Não foi possível alterar o responsável"),
  });
```

- [x] **Step 2: Passar as props novas ao `<LeadDialog>`**

No JSX, trocar a renderização de `<LeadDialog .../>` por:

```tsx
      <LeadDialog
        lead={openLead}
        isAdmin={me.isAdmin}
        profiles={profilesQuery.data ?? []}
        onClose={() => setOpenLead(null)}
        onStatusChange={(next) =>
          openLead && updateStatus.mutate({ id: openLead.id, next })
        }
        onAssign={(ownerId) => {
          if (!openLead) return;
          assignOwner.mutate({ id: openLead.id, ownerId });
          setOpenLead({ ...openLead, owner_id: ownerId });
        }}
      />
```

- [x] **Step 3: Atualizar a assinatura de `LeadDialog`**

Trocar o cabeçalho da função `LeadDialog` por:

```tsx
function LeadDialog({
  lead,
  isAdmin,
  profiles,
  onClose,
  onStatusChange,
  onAssign,
}: {
  lead: Lead | null;
  isAdmin: boolean;
  profiles: Profile[];
  onClose: () => void;
  onStatusChange: (next: LeadStatus) => void;
  onAssign: (ownerId: string | null) => void;
}) {
```

- [x] **Step 4: Renderizar o campo "Responsável"**

Dentro do `<>...</>` de `LeadDialog`, logo antes do bloco `<div className="mt-2">` que contém o `<Label htmlFor="status">`, inserir:

```tsx
            <div className="mt-2">
              <Label htmlFor="owner">Responsável</Label>
              {isAdmin ? (
                <select
                  id="owner"
                  value={lead.owner_id ?? ""}
                  onChange={(e) => onAssign(e.target.value || null)}
                  className={`mt-1.5 w-full ${selectClass}`}
                >
                  <option value="">Pool (sem dono)</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name || p.email}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">Você</p>
              )}
            </div>
```

- [x] **Step 5: Checar tipos e build**

```bash
npx tsc --noEmit && npm run build
```

Esperado: sem erros.

- [ ] **Step 6: Commit (opcional)**

```bash
git add src/routes/_authenticated/crm.tsx
git commit -m "feat(crm): admin atribui responsavel no LeadDialog"
```

---

## Task 7: Filtro "Responsável" na barra (admin)

**Files:**
- Modify: `src/routes/_authenticated/crm.tsx`

**Interfaces:**
- Consumes: `me.isAdmin` (Task 4), `ownerFilter`/`setOwnerFilter` (Task 5), `profilesQuery` (Task 6).
- Produces: nada novo.

- [x] **Step 1: Ampliar o grid de filtros**

No `<div className="panel-metal grid gap-3 rounded-xl p-4 md:grid-cols-5">`, trocar `md:grid-cols-5` por `md:grid-cols-3 lg:grid-cols-6`.

- [x] **Step 2: Adicionar o `<select>` de responsável**

Logo após o `<select>` de `status` (o que tem `<option value="">Todos os status</option>`), inserir:

```tsx
          {me.isAdmin && (
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className={selectClass}
            >
              <option value="">Todos os responsáveis</option>
              <option value="pool">Pool (sem dono)</option>
              {(profilesQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name || p.email}
                </option>
              ))}
            </select>
          )}
```

- [x] **Step 3: Checar tipos e build**

```bash
npx tsc --noEmit && npm run build
```

Esperado: sem erros.

- [ ] **Step 4: Commit (opcional)**

```bash
git add src/routes/_authenticated/crm.tsx
git commit -m "feat(crm): filtro por responsavel para admin"
```

---

## Task 8: Verificação final (lint, build, checklist manual)

**Files:** nenhum (verificação).

- [x] **Step 1: Lint e build**

```bash
npm run lint && npm run build
```

Esperado: ambos sem erro.

- [ ] **Step 2: Re-rodar a verificação de RLS**

```bash
node --env-file=.env --env-file=.env.local scripts/verify-rls.mjs
```

Esperado: `TODOS OS TESTES DE RLS PASSARAM`.

- [ ] **Step 3: Checklist manual no CRM**

Pré-requisito: ter no Supabase (via signup real ou `auth.admin.createUser`) um usuário **admin** (o primeiro do projeto) e dois usuários **team** (`teamA`, `teamB`). Submeter 2–3 leads pelo formulário público (`/`).

`npm run dev` e validar:

1. **Login como `teamA`** → `/crm`: lista **vazia** (nenhum lead atribuído). Nenhum `<select>` "Todos os responsáveis" na barra. No `LeadDialog` (se abrir algum, ainda não terá) o campo "Responsável" não é editável.
2. **Login como admin** → `/crm`: vê **todos** os leads submetidos. Barra mostra o filtro "Responsável". Filtro `Pool (sem dono)` lista os leads recém-submetidos; filtrar por `teamA` → vazio.
3. **Admin abre um lead → "Responsável" → `teamA` → salva**: toast "Responsável atualizado"; com o filtro em `teamA` o lead aparece, e some de `Pool`.
4. **Login como `teamA`** de novo: agora vê **1 lead** (o atribuído). Abre o lead, muda status, adiciona nota → funciona. Campo "Responsável" mostra "Você", sem `<select>`.
5. **Login como `teamB`**: **não** vê o lead de `teamA` (lista vazia). Não há como abri-lo.
6. **Preview local sem login** (`import.meta.env.PROD` falso): `/crm` ainda mostra os `DEMO_LEADS`.

- [ ] **Step 4: Limpeza dos usuários de teste (se criados só para o checklist)**

Remover via painel do Supabase (**Authentication → Users**) os usuários `team` criados apenas para o checklist, se não forem permanecer.

- [ ] **Step 5: Commit final (opcional)**

```bash
git add -A
git commit -m "chore: isolamento de dados por usuario concluido"
```

---

## Self-Review (executado pelo autor do plano)

**1. Cobertura da spec**

| Item da spec | Task |
|---|---|
| `profiles` (tabela, GRANTs, RLS) | 1 |
| `is_admin()` | 1 |
| `leads.owner_id` + índice | 1 |
| Trigger `handle_new_user` (profile + papel `team`/`admin`) | 1 |
| Backfill de `profiles` | 1 |
| Trigger `enforce_lead_owner_change` (só admin muda `owner_id`) | 1 |
| RLS `profiles` / `leads` / `lead_notes` | 1 |
| `user_roles` inalterado | (nenhuma alteração — ok) |
| `is_team()` fica órfã (dívida, não remover agora) | respeitado (Task 1 não a toca) |
| `types.ts` manual (`owner_id`, `profiles`, `is_admin`) | 3 |
| `crm.tsx`: contexto `me` + `isAdmin` | 4 |
| `crm.tsx`: `leadsQuery` role-aware + `.eq` explícito + guarda de preview | 5 |
| `crm.tsx`: fallback `DEMO_LEADS` só sem sessão real | 5 |
| `crm.tsx`: `profilesQuery` (admin) | 6 |
| `crm.tsx`: campo "Responsável" no `LeadDialog` (admin edita, team lê) | 6 |
| `crm.tsx`: filtro "Responsável" na barra (admin) | 7 |
| `LeadForm.tsx` sem mudança; insert com `owner_id` é rejeitado | verificado na Task 2 (Step 2) |
| Verificação: script RLS + checklist manual | 2, 8 |
| Seção "troca de instância Supabase" | fora do escopo de código — documentada na spec |

Sem lacunas.

**2. Placeholders:** nenhum `TODO`/`TBD`; todos os passos de código têm bloco literal.

**3. Consistência de tipos/nomes:**
- `Me` / `me` / `meQuery` — Tasks 4–7 coerentes.
- `Profile` (`{ id; email; display_name }`) — Tasks 4, 6, 7 coerentes.
- `ownerFilter` valores `"" | "pool" | uuid` — Tasks 5 e 7 coerentes.
- `assignOwner.mutate({ id, ownerId })` — assinatura única (Task 6).
- `LeadDialog` props (`isAdmin`, `profiles`, `onAssign`) — definidas e passadas na Task 6.
- Nomes de política e função batem entre a migration (Task 1), o script (Task 2) e as queries (Tasks 5–7).

Desvios da spec (menores, registrados): a spec citava `supabase/tests/rls.sql` via `psql`; como não há `psql`/CLI local, a verificação é `scripts/verify-rls.mjs` (Node + `@supabase/supabase-js`, já dependência). `enforce_lead_owner_change` é `SECURITY INVOKER` (não precisa de privilégio elevado; `auth.uid()` resolve normalmente).
