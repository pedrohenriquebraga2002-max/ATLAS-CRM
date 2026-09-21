export const COUNTRIES = [
  "Estados Unidos",
  "Portugal",
  "Irlanda",
  "Reino Unido",
  "Canadá",
  "Espanha",
  "Itália",
  "Alemanha",
  "França",
  "Suíça",
  "Holanda",
  "Bélgica",
  "Japão",
  "Austrália",
  "Emirados Árabes Unidos",
  "México",
  "Outro",
];

export const SEGMENTS = [
  "Restaurante / Food service",
  "Salão de beleza / Estética",
  "Imobiliária",
  "Serviços gerais (limpeza, construção, transporte)",
  "E-commerce",
  "Consultoria / Serviço profissional",
  "Outros",
];

export const REVENUE_RANGES = [
  "Até 5 mil (USD/EUR)",
  "5 mil a 15 mil (USD/EUR)",
  "15 mil a 30 mil (USD/EUR)",
  "30 mil a 60 mil (USD/EUR)",
  "60 mil a 100 mil (USD/EUR)",
  "Acima de 100 mil (USD/EUR)",
];

/** Gera faixas de faturamento localizadas com a moeda do visitante */
export function getRevenueRanges(currencyCode: string): string[] {
  return [
    `Até 5 mil (${currencyCode})`,
    `5 mil a 15 mil (${currencyCode})`,
    `15 mil a 30 mil (${currencyCode})`,
    `30 mil a 60 mil (${currencyCode})`,
    `60 mil a 100 mil (${currencyCode})`,
    `Acima de 100 mil (${currencyCode})`,
  ];
}

export const LEAD_STATUSES = [
  { value: "novo", label: "Novo" },
  { value: "em_contato", label: "Em contato" },
  { value: "qualificado", label: "Qualificado" },
  { value: "convertido", label: "Convertido" },
  { value: "perdido", label: "Perdido" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];

export const statusLabel = (status: string) =>
  LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
