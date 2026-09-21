import { createFileRoute } from "@tanstack/react-router";
import { Header, Hero, Marquee, VideoShowcase, About, Method, Services, Plans, ClosingCta, Faq, Footer } from "@/components/landing/Sections";
import { LeadForm } from "@/components/landing/LeadForm";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Assessoria Atlas | Marketing para brasileiros no exterior" },
      {
        name: "description",
        content:
          "A Atlas estrutura o marketing de negócios de brasileiros no exterior: tráfego pago, redes sociais e vendas todos os dias. Fale com um especialista.",
      },
      { property: "og:title", content: "Assessoria Atlas | Marketing para brasileiros no exterior" },
      {
        property: "og:description",
        content:
          "Método validado com +50 negócios de brasileiros em mais de 10 países. Diagnóstico gratuito com um especialista Atlas.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Marquee />
        <LeadForm />
        <VideoShowcase />
        <About />
        <Method />
        <Services />
        <Plans />
        <ClosingCta />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
