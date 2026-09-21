import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LEAD_STATUSES, statusLabel, COUNTRIES, SEGMENTS, REVENUE_RANGES, type LeadStatus } from "@/lib/atlas-data";
import atlasLogo from "@/assets/atlas-logo.png.asset.json";
import { LogOut, Search, TrendingUp, Users, UserCheck, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/crm")({
  component: CrmPage,
  head: () => ({
    meta: [
      { title: "CRM Atlas | Funil de leads" },
      { name: "description", content: "Painel interno da Assessoria Atlas para gestão de leads." },
      { property: "og:title", content: "CRM Atlas | Funil de leads" },
      { property: "og:description", content: "Painel interno da Assessoria Atlas para gestão de leads." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  business_name: string | null;
  segment: string;
  revenue_range: string | null;
  would_invest: boolean | null;
  status: LeadStatus;
  owner_id: string | null;
  notes: string | null;
  created_at: string;
};

type Note = { id: string; body: string; created_at: string };
type Profile = { id: string; email: string; display_name: string | null };
type Me = { userId: string | null; isAdmin: boolean; isReal: boolean };

const selectClass = "h-10 rounded-md border border-border bg-surface-2 px-3 text-sm";

function CrmPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("");
  const [country, setCountry] = useState("");
  const [revenue, setRevenue] = useState("");
  const [status, setStatus] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>(""); // "" | "pool" | uuid
  const [openLead, setOpenLead] = useState<Lead | null>(null);

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

  const leadsQuery = useQuery({
    queryKey: ["leads", me.userId, me.isAdmin, ownerFilter],
    enabled: !meQuery.isLoading,
    queryFn: async () => {
      if (!me.isReal) return [] as Lead[]; // preview local sem sessão -> DEMO_LEADS
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

  const updateStatus = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: LeadStatus }) => {
      const { error } = await supabase.from("leads").update({ status: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Status atualizado");
    },
    onError: () => toast.error("Não foi possível atualizar o status"),
  });

const EMPTY_LEADS: Lead[] = [];

const DEMO_LEADS: Lead[] = [
  { id: "1", name: "Rodrigo Mendonça", email: "rodrigo@restaurante.com", phone: "+1 407 555 0192", country: "Estados Unidos", business_name: "Sabor Brasil Orlando", segment: "Restaurante / Food service", revenue_range: "30 mil a 60 mil (USD/EUR)", would_invest: true, status: "qualificado", owner_id: null, notes: "Liguei dia 02, agendada reunião de onboarding.", created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: "2", name: "Camila Silva", email: "camila@beautystudio.pt", phone: "+351 912 345 678", country: "Portugal", business_name: "Camila Beauty Studio", segment: "Salão de beleza / Estética", revenue_range: "15 mil a 30 mil (USD/EUR)", would_invest: true, status: "convertido", owner_id: null, notes: "Cliente fechou o plano Growth.", created_at: new Date(Date.now() - 12 * 86400000).toISOString() },
  { id: "3", name: "Diego Alves", email: "diego@dublinrealestate.ie", phone: "+353 83 123 4567", country: "Irlanda", business_name: "Dublin Irish Homes", segment: "Imobiliária", revenue_range: "60 mil a 100 mil (USD/EUR)", would_invest: true, status: "em_contato", owner_id: null, notes: "Aguardando envio da proposta comercial.", created_at: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: "4", name: "Patricia Lima", email: "patricia@londonfashion.uk", phone: "+44 7700 900077", country: "Reino Unido", business_name: "London Chic E-commerce", segment: "E-commerce", revenue_range: "15 mil a 30 mil (USD/EUR)", would_invest: true, status: "novo", owner_id: null, notes: null, created_at: new Date().toISOString() },
  { id: "5", name: "Marcelo Rocha", email: "marcelo@cleaningservices.ca", phone: "+1 416 555 0143", country: "Canadá", business_name: "CleanMaster Toronto", segment: "Serviços gerais (limpeza, construção, transporte)", revenue_range: "5 mil a 15 mil (USD/EUR)", would_invest: false, status: "perdido", owner_id: null, notes: "Sem orçamento no momento.", created_at: new Date(Date.now() - 20 * 86400000).toISOString() },
];

  const leads =
    !me.isReal && (!leadsQuery.data || leadsQuery.data.length === 0)
      ? DEMO_LEADS
      : (leadsQuery.data ?? EMPTY_LEADS);

  const filtered = useMemo(
    () =>
      leads.filter((lead) => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          !q ||
          [lead.name, lead.email, lead.phone, lead.business_name ?? ""].some((v) =>
            v.toLowerCase().includes(q),
          );
        return (
          matchesSearch &&
          (!segment || lead.segment === segment) &&
          (!country || lead.country === country) &&
          (!revenue || lead.revenue_range === revenue) &&
          (!status || lead.status === status)
        );
      }),
    [leads, search, segment, country, revenue, status],
  );

  async function signOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img src={atlasLogo.url} alt="Atlas" className="atlas-logo h-9 w-9 shrink-0 object-contain" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold uppercase">CRM Atlas</h1>
              <p className="truncate text-xs text-muted-foreground">
                {leads.length} leads no funil
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={signOut} className="shrink-0">
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="panel-metal grid gap-3 rounded-xl p-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="relative md:col-span-1">
            <Search className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar lead"
              className="h-10 bg-surface-2 pl-9"
            />
          </div>
          <select value={segment} onChange={(e) => setSegment(e.target.value)} className={selectClass}>
            <option value="">Todos os segmentos</option>
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={selectClass}>
            <option value="">Todos os países</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={revenue} onChange={(e) => setRevenue(e.target.value)} className={selectClass}>
            <option value="">Todo faturamento</option>
            {REVENUE_RANGES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
            <option value="">Todos os status</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
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
        </div>

        {meQuery.isLoading || leadsQuery.isLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">Carregando leads...</p>
        ) : (
          <Tabs defaultValue="kanban" className="mt-6">
            <TabsList>
              <TabsTrigger value="kanban">Funil (Kanban)</TabsTrigger>
              <TabsTrigger value="table">Tabela</TabsTrigger>
              <TabsTrigger value="evolucao">Evolução</TabsTrigger>
            </TabsList>

            <TabsContent value="kanban" className="mt-4">
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
                {LEAD_STATUSES.map((column) => {
                  const items = filtered.filter((lead) => lead.status === column.value);
                  return (
                    <div key={column.value} className="panel-metal rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold tracking-widest uppercase">{column.label}</h2>
                        <Badge variant="secondary">{items.length}</Badge>
                      </div>
                      <div className="mt-3 space-y-3">
                        {items.map((lead) => (
                          <button
                            key={lead.id}
                            onClick={() => setOpenLead(lead)}
                            className="w-full rounded-lg border border-border bg-surface-2 p-3 text-left transition-colors hover:border-silver-dim"
                          >
                            <p className="truncate text-sm font-semibold">{lead.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {lead.business_name || lead.segment}
                            </p>
                            <p className="mt-1 truncate text-xs text-silver-dim">{lead.country}</p>
                          </button>
                        ))}
                        {items.length === 0 && (
                          <p className="py-4 text-center text-xs text-muted-foreground">Vazio</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="table" className="mt-4">
              <div className="panel-metal overflow-x-auto rounded-xl">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-xs tracking-wider text-muted-foreground uppercase">
                    <tr>
                      <th className="p-3">Nome</th>
                      <th className="p-3">País</th>
                      <th className="p-3">Segmento</th>
                      <th className="p-3">Faturamento</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Criado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((lead) => (
                      <tr
                        key={lead.id}
                        onClick={() => setOpenLead(lead)}
                        className="cursor-pointer border-b border-border/60 hover:bg-surface-2"
                      >
                        <td className="p-3">
                          <p className="font-medium">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.email}</p>
                        </td>
                        <td className="p-3">{lead.country}</td>
                        <td className="p-3">{lead.segment}</td>
                        <td className="p-3">{lead.revenue_range ?? "—"}</td>
                        <td className="p-3">
                          <Badge variant="secondary">{statusLabel(lead.status)}</Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Nenhum lead encontrado com esses filtros.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="evolucao" className="mt-4">
              <EvolutionDashboard leads={leads} />
            </TabsContent>
          </Tabs>
        )}
      </div>

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
    </div>
  );
}

/* ─────────────────────────── Evolution Dashboard ─────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  novo: "oklch(0.72 0.16 155)",       // verde
  em_contato: "oklch(0.8 0.15 85)",   // amarelo
  qualificado: "oklch(0.7 0.14 250)", // azul
  convertido: "oklch(0.85 0.12 80)",  // dourado
  perdido: "oklch(0.58 0.21 25)",     // vermelho
};

function EvolutionDashboard({ leads }: { leads: Lead[] }) {
  const stats = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const total = leads.length;
    const novos7d = leads.filter((l) => new Date(l.created_at) >= sevenDaysAgo).length;
    const convertidos = leads.filter((l) => l.status === "convertido").length;
    const qualificados = leads.filter((l) => l.status === "qualificado").length;
    const taxaConversao = total > 0 ? ((convertidos / total) * 100).toFixed(1) : "0";

    // Status distribution
    const byStatus = LEAD_STATUSES.map((s) => ({
      label: s.label,
      value: s.value,
      count: leads.filter((l) => l.status === s.value).length,
    }));

    // Top countries
    const countryMap = new Map<string, number>();
    leads.forEach((l) => countryMap.set(l.country, (countryMap.get(l.country) ?? 0) + 1));
    const topCountries = [...countryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Top segments
    const segmentMap = new Map<string, number>();
    leads.forEach((l) => segmentMap.set(l.segment, (segmentMap.get(l.segment) ?? 0) + 1));
    const topSegments = [...segmentMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Weekly timeline (last 8 weeks)
    const weeks: { label: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const count = leads.filter((l) => {
        const d = new Date(l.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      weeks.push({
        label: weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        count,
      });
    }

    return { total, novos7d, taxaConversao, qualificados, convertidos, byStatus, topCountries, topSegments, weeks };
  }, [leads]);

  const maxWeekly = Math.max(...stats.weeks.map((w) => w.count), 1);
  const maxStatus = Math.max(...stats.byStatus.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Users className="h-5 w-5" />}
          label="Total de leads"
          value={String(stats.total)}
        />
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Novos (últimos 7 dias)"
          value={String(stats.novos7d)}
          accent
        />
        <SummaryCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Taxa de conversão"
          value={`${stats.taxaConversao}%`}
        />
        <SummaryCard
          icon={<UserCheck className="h-5 w-5" />}
          label="Qualificados"
          value={String(stats.qualificados)}
        />
      </div>

      {/* Status Distribution + Weekly Timeline */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status Bars */}
        <div className="panel-metal rounded-xl p-5">
          <h3 className="text-xs font-bold tracking-widest uppercase">Distribuição por status</h3>
          <div className="mt-4 space-y-3">
            {stats.byStatus.map((s) => (
              <div key={s.value}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{s.label}</span>
                  <span className="text-muted-foreground">{s.count}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${(s.count / maxStatus) * 100}%`,
                      backgroundColor: STATUS_COLORS[s.value] ?? "var(--silver)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Timeline */}
        <div className="panel-metal rounded-xl p-5">
          <h3 className="text-xs font-bold tracking-widest uppercase">Leads por semana</h3>
          <div className="mt-4 flex items-end gap-2" style={{ height: 160 }}>
            {stats.weeks.map((w, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-muted-foreground">{w.count}</span>
                <div
                  className="w-full rounded-t-md transition-all duration-700 ease-out"
                  style={{
                    height: `${Math.max((w.count / maxWeekly) * 120, 4)}px`,
                    background: "linear-gradient(to top, oklch(0.85 0.12 80), oklch(0.70 0.14 90))",
                  }}
                />
                <span className="text-[9px] text-muted-foreground">{w.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Country + Segment Distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Countries */}
        <div className="panel-metal rounded-xl p-5">
          <h3 className="text-xs font-bold tracking-widest uppercase">Top 5 países</h3>
          {stats.topCountries.length === 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {stats.topCountries.map(([country, count]) => {
                const maxCountry = stats.topCountries[0]?.[1] ?? 1;
                return (
                  <div key={country}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{country}</span>
                      <span className="text-muted-foreground">{count} leads</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${(count / maxCountry) * 100}%`,
                          background: "linear-gradient(90deg, oklch(0.88 0.11 85), oklch(0.93 0.09 75))",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Segments */}
        <div className="panel-metal rounded-xl p-5">
          <h3 className="text-xs font-bold tracking-widest uppercase">Top segmentos</h3>
          {stats.topSegments.length === 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {stats.topSegments.map(([segment, count]) => {
                const maxSeg = stats.topSegments[0]?.[1] ?? 1;
                return (
                  <div key={segment}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{segment}</span>
                      <span className="text-muted-foreground">{count} leads</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${(count / maxSeg) * 100}%`,
                          background: "linear-gradient(90deg, oklch(0.7 0.14 250), oklch(0.8 0.10 260))",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Conversion Funnel Summary */}
      <div className="panel-metal ring-metal rounded-xl p-5">
        <h3 className="text-xs font-bold tracking-widest uppercase">Resumo do funil</h3>
        <div className="mt-4 flex items-center gap-1 overflow-hidden rounded-lg" style={{ height: 32 }}>
          {stats.byStatus
            .filter((s) => s.count > 0)
            .map((s) => (
              <div
                key={s.value}
                className="flex h-full items-center justify-center text-[10px] font-bold text-background transition-all duration-700"
                style={{
                  width: `${(s.count / stats.total) * 100}%`,
                  backgroundColor: STATUS_COLORS[s.value] ?? "var(--silver)",
                  minWidth: 32,
                }}
                title={`${s.label}: ${s.count}`}
              >
                {s.count}
              </div>
            ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-3">
          {stats.byStatus.map((s) => (
            <span key={s.value} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[s.value] ?? "var(--silver)" }}
              />
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="panel-metal rounded-xl p-5">
      <div className="flex items-center gap-3">
        <div
          className="grid h-10 w-10 place-items-center rounded-lg"
          style={{
            background: accent
              ? "linear-gradient(135deg, oklch(0.85 0.12 80), oklch(0.70 0.14 90))"
              : "var(--surface-2)",
            color: accent ? "oklch(0.14 0 0)" : "var(--silver)",
          }}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs tracking-wider text-muted-foreground uppercase">{label}</p>
          <p className="mt-0.5 text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

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
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const notesQuery = useQuery({
    queryKey: ["lead_notes", lead?.id],
    enabled: !!lead,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_notes")
        .select("id, body, created_at")
        .eq("lead_id", lead!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });

  const addNote = useMutation({
    mutationFn: async (body: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("lead_notes").insert({
        lead_id: lead!.id,
        body,
        author_id: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["lead_notes", lead?.id] });
      toast.success("Interação registrada");
    },
    onError: () => toast.error("Não foi possível salvar a anotação"),
  });

  return (
    <Dialog open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {lead && (
          <>
            <DialogHeader>
              <DialogTitle className="text-left">{lead.name}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="E-mail" value={lead.email} />
              <Info label="WhatsApp" value={lead.phone} />
              <Info label="País" value={lead.country} />
              <Info label="Negócio" value={lead.business_name ?? "—"} />
              <Info label="Segmento" value={lead.segment} />
              <Info label="Faturamento" value={lead.revenue_range ?? "—"} />
              <Info label="Investiria" value={lead.would_invest ? "Sim" : "Não"} />
              <Info
                label="Recebido em"
                value={new Date(lead.created_at).toLocaleString("pt-BR")}
              />
            </div>

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

            <div className="mt-2">
              <Label htmlFor="status">Status no funil</Label>
              <select
                id="status"
                value={lead.status}
                onChange={(e) => onStatusChange(e.target.value as LeadStatus)}
                className={`mt-1.5 w-full ${selectClass}`}
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="mt-2">
              <Label htmlFor="note">Nova anotação / interação</Label>
              <Textarea
                id="note"
                value={note}
                maxLength={2000}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: liguei às 14h, cliente pediu proposta."
                className="mt-1.5 bg-surface-2"
              />
              <Button
                className="mt-2 w-full font-semibold"
                disabled={!note.trim() || addNote.isPending}
                onClick={() => addNote.mutate(note.trim())}
              >
                Registrar interação
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-bold tracking-widest uppercase">Histórico</h3>
              {notesQuery.data?.length ? (
                notesQuery.data.map((n) => (
                  <div key={n.id} className="rounded-lg border border-border bg-surface-2 p-3">
                    <p className="text-sm">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma interação registrada.</p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <p className="text-xs tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 break-words">{value}</p>
    </div>
  );
}
