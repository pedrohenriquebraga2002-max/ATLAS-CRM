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
