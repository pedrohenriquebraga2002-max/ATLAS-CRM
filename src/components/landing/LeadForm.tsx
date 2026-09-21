import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRIES, SEGMENTS, getRevenueRanges } from "@/lib/atlas-data";
import { useCurrency, currencyTexts } from "@/lib/currency-detection";
import { CheckCircle2, ClipboardList, PhoneCall } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  phone: z.string().trim().min(8, "Informe o WhatsApp com DDI").max(30),
  country: z.string().min(1, "Selecione o país"),
  business_name: z.string().trim().max(120).optional(),
  segment: z.string().min(1, "Selecione o segmento"),
  revenue_range: z.string().min(1, "Selecione o faturamento"),
  would_invest: z.enum(["sim", "nao"]),
});

const fieldClass =
  "h-11 bg-surface-2 border-border text-foreground placeholder:text-muted-foreground";

const selectClass =
  "h-11 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground";

export function LeadForm() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const currency = useCurrency();
  const ct = currencyTexts(currency);
  const revenueRanges = getRevenueRanges(currency.code);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = schema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      country: form.get("country"),
      business_name: form.get("business_name") ?? "",
      segment: form.get("segment"),
      revenue_range: form.get("revenue_range"),
      would_invest: form.get("would_invest"),
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("leads").insert({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      country: parsed.data.country,
      business_name: parsed.data.business_name || null,
      segment: parsed.data.segment,
      revenue_range: parsed.data.revenue_range,
      would_invest: parsed.data.would_invest === "sim",
    });
    setLoading(false);

    if (error) {
      toast.error("Não conseguimos enviar agora. Tente novamente.");
      return;
    }
    setDone(true);
    toast.success("Recebemos seus dados! Um especialista vai te chamar.");
  }

  return (
    <section id="formulario" className="section-py scroll-mt-16 bg-background">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-semibold tracking-[0.3em] text-silver-dim uppercase">
            Atenção
          </p>
          <h2 className="mt-3 text-2xl leading-tight font-extrabold uppercase sm:mt-4 sm:text-3xl lg:text-4xl">
            Não saia agora!
            <span className="text-metal block">Faltam poucos segundos</span>
            para o seu negócio mudar.
          </h2>

          <div className="mt-5 space-y-3 sm:mt-8 sm:space-y-4">
            <div className="panel-metal flex gap-3 rounded-xl p-4 sm:gap-4 sm:p-5">
              <ClipboardList className="mt-1 h-5 w-5 shrink-0 text-silver" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold sm:text-base">1. Complete o formulário</h3>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  Poucas informações para entendermos o seu negócio, o seu país e a fase em
                  que você está hoje.
                </p>
              </div>
            </div>
            <div className="panel-metal flex gap-3 rounded-xl p-4 sm:gap-4 sm:p-5">
              <PhoneCall className="mt-1 h-5 w-5 shrink-0 text-silver" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold sm:text-base">2. Receba um contato personalizado</h3>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  Em até 15 minutos um especialista Atlas fala com você por WhatsApp ou
                  ligação, no seu fuso horário.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="panel-metal ring-metal rounded-2xl p-5 sm:p-8">
          {done ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <h3 className="mt-4 text-xl font-bold">Solicitação enviada</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Nosso time comercial já recebeu seus dados e entrará em contato em poucos
                minutos.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" name="name" required maxLength={100} className={`mt-1.5 ${fieldClass}`} placeholder="Seu nome" />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email" required maxLength={255} className={`mt-1.5 ${fieldClass}`} placeholder="voce@email.com" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div>
                  <Label htmlFor="phone">WhatsApp (com DDI)</Label>
                  <Input id="phone" name="phone" required maxLength={30} className={`mt-1.5 ${fieldClass}`} placeholder="+1 305 000 0000" />
                </div>
                <div>
                  <Label htmlFor="country">País onde mora</Label>
                  <select id="country" name="country" required defaultValue="" className={`mt-1.5 ${selectClass}`}>
                    <option value="" disabled>
                      Selecione
                    </option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="business_name">Nome do negócio</Label>
                <Input id="business_name" name="business_name" maxLength={120} className={`mt-1.5 ${fieldClass}`} placeholder="Nome da sua empresa" />
              </div>

              <div>
                <Label htmlFor="segment">Segmento</Label>
                <select id="segment" name="segment" required defaultValue="" className={`mt-1.5 ${selectClass}`}>
                  <option value="" disabled>
                    Selecione
                  </option>
                  {SEGMENTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="revenue_range">Faturamento mensal atual</Label>
                <select id="revenue_range" name="revenue_range" required defaultValue="" className={`mt-1.5 ${selectClass}`}>
                  <option value="" disabled>
                    Selecione
                  </option>
                  {revenueRanges.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="would_invest">
                  Você investiria a partir de {ct.investLabel} por mês para vender mais?
                </Label>
                <select id="would_invest" name="would_invest" required defaultValue="sim" className={`mt-1.5 ${selectClass}`}>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>

              <Button type="submit" size="lg" disabled={loading} className="w-full font-semibold">
                {loading ? "Enviando..." : "Receber mais informações"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Seus dados são usados apenas para o contato comercial da Atlas.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
