import atlasLogo from "@/assets/atlas-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Instagram, Globe2, Megaphone, MessageSquare, MonitorSmartphone, Languages, Headphones, Check } from "lucide-react";
import { useCurrency, currencyTexts } from "@/lib/currency-detection";

function scrollToForm() {
  document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth" });
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:flex sm:justify-between sm:py-3">
        <a href="#top" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <img src={atlasLogo.url} alt="Assessoria Atlas" className="logo-blend h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
          <span className="truncate text-xs font-bold tracking-[0.25em] uppercase sm:text-sm">Atlas</span>
        </a>
        <Button onClick={scrollToForm} size="sm" className="shrink-0 text-xs font-semibold sm:text-sm">
          Falar com especialista
        </Button>
      </div>
    </header>
  );
}

export function Hero() {
  const currency = useCurrency();
  const ct = currencyTexts(currency);

  return (
    <section id="top" className="relative overflow-hidden border-b border-border">
      <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:py-20 lg:py-28">
        <img src={atlasLogo.url} alt="Logo Atlas" className="logo-blend mx-auto h-12 w-12 sm:h-16 sm:w-16" />
        <h1 className="mt-6 text-2xl leading-[1.08] font-extrabold uppercase sm:mt-8 sm:text-3xl lg:text-5xl">
          Fazemos o seu negócio no exterior
          <span className="text-metal block">vender {ct.heroValue} a cada {ct.heroUnit}</span>
          investido em tráfego pago.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:mt-6 sm:text-base lg:text-lg">
          Método validado com mais de 50 negócios de brasileiros fora do Brasil, em mais de 10
          países — com média de <strong className="text-foreground">+200% de clientes em 90 dias</strong>.
        </p>
        <div className="mt-7 flex flex-col items-center gap-3 sm:mt-9 sm:flex-row sm:justify-center">
          <Button size="lg" onClick={scrollToForm} className="w-full font-semibold sm:w-auto">
            Quero esse resultado no meu negócio
          </Button>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
            Especialistas online agora
          </span>
        </div>
      </div>
    </section>
  );
}

export function Marquee() {
  const currency = useCurrency();
  const ct = currencyTexts(currency);

  const marqueeItems = [
    "+50 CLIENTES ATIVOS",
    "+10 PAÍSES ATENDIDOS",
    "+10 ANOS DE EXPERIÊNCIA",
    ct.marqueeRoi,
    "+200% DE CLIENTES EM 90 DIAS",
  ];

  const items = [...marqueeItems, ...marqueeItems, ...marqueeItems, ...marqueeItems];
  return (
    <div className="overflow-hidden border-b border-border bg-surface-2 py-2.5 sm:py-3">
      <div className="marquee-track">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="flex items-center gap-4 px-4 text-[10px] font-bold tracking-[0.2em] whitespace-nowrap text-silver-dim uppercase sm:gap-6 sm:px-6 sm:text-xs"
          >
            {item}
            <span className="text-silver">•</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function VideoShowcase() {
  return (
    <section className="section-py border-b border-border">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-xs font-semibold tracking-[0.3em] text-silver-dim uppercase">
          Depoimentos
        </p>
        <h2 className="mt-3 max-w-3xl text-xl leading-tight font-extrabold uppercase sm:mt-4 sm:text-2xl lg:text-4xl">
          Mais de <span className="text-metal">50 negócios</span> de brasileiros no exterior com
          resultado. Isso é Atlas.
        </h2>
        <div className="mt-8 sm:mt-10">
          <div className="panel-metal ring-metal overflow-hidden rounded-2xl">
            <div className="relative w-full" style={{ aspectRatio: '9 / 16', maxHeight: '70vh' }}>
              <video
                className="h-full w-full object-contain bg-black"
                controls
                playsInline
                preload="metadata"
                poster=""
              >
                <source src="/atlas-feedback.mp4" type="video/mp4" />
                Seu navegador não suporta vídeo.
              </video>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground sm:text-sm">
            Veja como ajudamos empreendedores brasileiros a venderem mais no exterior.
          </p>
        </div>
      </div>
    </section>
  );
}

export function About() {
  return (
    <section className="section-py border-b border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:gap-10 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold tracking-[0.3em] text-silver-dim uppercase">
            Quem somos
          </p>
          <h2 className="mt-3 text-xl leading-tight font-extrabold uppercase sm:mt-4 sm:text-2xl lg:text-4xl">
            Especialistas em marketing para <span className="text-metal">brasileiros no exterior</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:mt-6 sm:text-base">
            A Atlas é a assessoria de marketing feita para quem empreende fora do Brasil. Nosso
            time multidisciplinar — tráfego pago, design, copy e especialistas em marketing
            digital — atua de forma remota e internacional, acompanhando o seu negócio no seu
            fuso e no seu mercado.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:mt-4 sm:text-base">
            Entendemos a realidade de quem vende em outro país: idioma, cultura local, meios de
            pagamento, sazonalidade e o peso da comunidade brasileira na sua região. É isso que
            separa uma campanha genérica de uma campanha que enche a sua agenda.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:gap-4">
          {[
            { icon: Globe2, title: "Atuação internacional", text: "Campanhas em 10+ países, adaptadas ao mercado local." },
            { icon: Languages, title: "Comunicação bilíngue", text: "Criativos e atendimento em português e no idioma local." },
            { icon: Headphones, title: "Time dedicado", text: "Especialistas acompanhando resultado semana a semana." },
            { icon: Megaphone, title: "Foco em vendas", text: "Cada real investido é medido em faturamento gerado." },
          ].map((item) => (
            <div key={item.title} className="panel-metal rounded-xl p-4 sm:p-5">
              <item.icon className="h-5 w-5 text-silver" />
              <h3 className="mt-2.5 text-sm font-semibold sm:mt-3">{item.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const methodSteps = ["Diagnóstico", "Posicionamento", "Tráfego", "Atendimento", "Retenção", "Escala"];

export function Method() {
  return (
    <section className="section-py border-b border-border">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <p className="text-xs font-semibold tracking-[0.3em] text-silver-dim uppercase">
          O método Atlas
        </p>
        <h2 className="mt-3 text-xl leading-tight font-extrabold uppercase sm:mt-4 sm:text-2xl lg:text-4xl">
          Existe um método comprovado para o seu negócio
          <span className="text-metal block">nunca parar de vender</span>
        </h2>
        <div className="panel-metal ring-metal mt-8 rounded-2xl p-5 sm:mt-12 sm:p-8">
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
            {methodSteps.map((step, i) => (
              <div key={step} className="rounded-xl border border-border bg-surface-2 p-3.5 text-left sm:p-5">
                <span className="text-[10px] font-bold tracking-widest text-silver-dim sm:text-xs">
                  0{i + 1}
                </span>
                <p className="mt-1.5 text-xs font-semibold sm:mt-2 sm:text-sm">{step}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-xs text-muted-foreground sm:mt-8 sm:text-sm">
            Um ciclo contínuo: entendemos o seu mercado, posicionamos a marca, geramos demanda
            com tráfego pago, estruturamos o atendimento comercial e escalamos o que já está
            dando resultado.
          </p>
        </div>
      </div>
    </section>
  );
}

const services = [
  { icon: Megaphone, title: "Tráfego pago", text: "Meta Ads e Google Ads segmentados para a comunidade brasileira e o público local." },
  { icon: Instagram, title: "Gestão de redes sociais", text: "Conteúdo, calendário e criativos que constroem autoridade no seu país." },
  { icon: MonitorSmartphone, title: "Site, landing page e e-commerce", text: "Páginas de alta conversão, rápidas e prontas para anúncios." },
  { icon: MessageSquare, title: "Disparo inteligente", text: "Campanhas de WhatsApp e SMS para reativar clientes e aumentar recompra." },
  { icon: Headphones, title: "Gestão e atendimento comercial", text: "Scripts, funil e acompanhamento para o lead virar venda." },
  { icon: Languages, title: "Branding bilíngue", text: "Identidade e mensagem que funcionam em dois idiomas e duas culturas." },
];

export function Services() {
  return (
    <section className="section-py border-b border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="max-w-3xl text-xl leading-tight font-extrabold uppercase sm:text-2xl lg:text-4xl">
          A <span className="text-metal">Assessoria Atlas</span> estrutura o marketing do seu
          negócio com base na sua necessidade
        </h2>
        <div className="mt-7 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {services.map((s) => (
            <article key={s.title} className="panel-metal rounded-xl p-5 sm:p-6">
              <s.icon className="h-5 w-5 text-silver sm:h-6 sm:w-6" />
              <h3 className="mt-3 text-sm font-semibold sm:mt-4 sm:text-base">{s.title}</h3>
              <p className="mt-1.5 text-xs text-muted-foreground sm:mt-2 sm:text-sm">{s.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function usePlans() {
  const currency = useCurrency();
  return [
    {
      name: "Starter",
      tag: "Para começar a vender online",
      items: ["Tráfego pago em 1 canal", "Criativos mensais", "Landing page de conversão", "Relatório mensal"],
    },
    {
      name: "Growth",
      tag: "Para escalar demanda",
      items: ["Tráfego em Meta + Google", "Gestão de redes sociais", "Disparos de WhatsApp", "Acompanhamento semanal"],
      featured: true,
    },
    {
      name: "Atlas Plus",
      tag: "Para grandes operações e escala",
      items: ["Estratégia dedicada", "Branding bilíngue", "Gestão comercial completa", "Squad exclusivo"],
    },
  ];
}

export function Plans() {
  const plans = usePlans();

  return (
    <section className="section-py border-b border-border">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="max-w-2xl text-xl leading-tight font-extrabold uppercase sm:text-2xl lg:text-4xl">
          Você escolhe a solução certa para a fase que o seu negócio
          <span className="text-metal"> vive hoje</span>
        </h2>
        <div className="mt-7 grid gap-3 sm:mt-10 sm:gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`panel-metal rounded-2xl p-5 sm:p-6 ${plan.featured ? "ring-metal" : ""}`}
            >
              <h3 className="text-base font-bold uppercase sm:text-lg">{plan.name}</h3>
              <p className="mt-1 text-[10px] tracking-wider text-silver-dim uppercase sm:text-xs">{plan.tag}</p>
              <ul className="mt-4 space-y-2 sm:mt-5">
                {plan.items.map((item) => (
                  <li key={item} className="flex gap-2 text-xs text-muted-foreground sm:text-sm">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-silver sm:h-4 sm:w-4" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                onClick={scrollToForm}
                variant={plan.featured ? "default" : "secondary"}
                className="mt-5 w-full text-xs font-semibold sm:mt-6 sm:text-sm"
              >
                Quero um plano personalizado
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section className="section-py border-b border-border bg-surface">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-xl leading-tight font-extrabold uppercase sm:text-2xl lg:text-4xl">
          Seu negócio fora do Brasil pode vender
          <span className="text-metal block">todos os dias</span>
        </h2>
        <p className="mt-4 text-sm text-muted-foreground sm:mt-5 sm:text-base">
          Fale com um especialista Atlas, receba um diagnóstico gratuito e veja exatamente o que
          está travando as suas vendas hoje.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:mt-8">
          <Button size="lg" onClick={scrollToForm} className="w-full font-semibold sm:w-auto">
            Quero esse resultado no meu negócio
          </Button>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
            Especialistas online agora
          </span>
        </div>
      </div>
    </section>
  );
}

const faqs = [
  {
    q: "O que exatamente a Atlas faz?",
    a: "Cuidamos do marketing do seu negócio no exterior de ponta a ponta: tráfego pago, criativos, redes sociais, páginas de conversão, disparos de WhatsApp e estruturação do atendimento comercial.",
  },
  {
    q: "Vocês atendem qualquer país e segmento?",
    a: "Atendemos brasileiros empreendedores em mais de 10 países. Trabalhamos principalmente com restaurantes, salões, imobiliárias, serviços gerais, e-commerces e profissionais liberais.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Trabalhamos com contratos claros e sem multas abusivas — nossa retenção vem de resultado, não de burocracia.",
  },
  {
    q: "Em quanto tempo vejo resultado?",
    a: "Os primeiros contatos qualificados normalmente aparecem nos primeiros 15 dias. A curva de escala consistente acontece entre 60 e 90 dias.",
  },
  {
    q: "Vocês cuidam do meu Instagram e redes sociais?",
    a: "Sim, nos planos que incluem gestão de redes: planejamento de conteúdo, criativos, publicações e acompanhamento de performance.",
  },
  {
    q: "Como funciona o atendimento estando eu fora do Brasil?",
    a: "Todo o atendimento é remoto e adaptado ao seu fuso horário, por WhatsApp e reuniões online, com um responsável direto pela sua conta.",
  },
];

export function Faq() {
  return (
    <section className="section-py border-b border-border">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="text-xl leading-tight font-extrabold uppercase sm:text-2xl lg:text-3xl">
            Perguntas <span className="text-metal">frequentes</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:mt-4">
            Ainda com dúvida? Preencha o formulário e fale com um especialista.
          </p>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={faq.q} value={`item-${i}`} className="border-border">
              <AccordionTrigger className="text-left text-xs font-semibold sm:text-sm">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground sm:text-sm">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-surface">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:py-10">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <img src={atlasLogo.url} alt="Assessoria Atlas" className="logo-blend h-8 w-8 shrink-0 sm:h-10 sm:w-10" />
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.25em] uppercase sm:text-sm">Atlas</p>
            <p className="text-[10px] text-muted-foreground sm:text-xs">
              Marketing para brasileiros no exterior
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:gap-4 sm:text-sm">
          <a
            href="https://www.instagram.com/assessoriaatlass/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 hover:text-foreground"
          >
            <Instagram className="h-4 w-4" /> @assessoriaatlass
          </a>
          <a href="#formulario" className="hover:text-foreground">
            Falar com especialista
          </a>
          <a href="/crm" className="hover:text-foreground">
            Área da equipe
          </a>
        </div>
      </div>
      <div className="border-t border-border py-3 text-center text-[10px] text-muted-foreground sm:py-4 sm:text-xs">
        © {new Date().getFullYear()} Assessoria Atlas. Todos os direitos reservados.
      </div>
    </footer>
  );
}
