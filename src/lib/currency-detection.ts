import { useMemo } from "react";

/**
 * Detecta a moeda do visitante com base no timezone do navegador.
 * Não faz chamadas externas — usa a API Intl nativa.
 */

export type CurrencyInfo = {
  code: string;   // ISO 4217: USD, EUR, GBP, JPY, etc.
  symbol: string;  // US$, €, £, ¥, etc.
  label: string;   // "dólares", "euros", etc.
  region: string;  // "americas", "europe", "asia", "oceania", "middle_east", "africa"
};

const CURRENCY_MAP: Record<string, CurrencyInfo> = {
  // Américas
  USD: { code: "USD", symbol: "US$", label: "dólares", region: "americas" },
  CAD: { code: "CAD", symbol: "CA$", label: "dólares canadenses", region: "americas" },
  MXN: { code: "MXN", symbol: "MX$", label: "pesos mexicanos", region: "americas" },
  BRL: { code: "BRL", symbol: "R$", label: "reais", region: "americas" },
  ARS: { code: "ARS", symbol: "AR$", label: "pesos argentinos", region: "americas" },
  CLP: { code: "CLP", symbol: "CL$", label: "pesos chilenos", region: "americas" },
  COP: { code: "COP", symbol: "CO$", label: "pesos colombianos", region: "americas" },
  PEN: { code: "PEN", symbol: "S/", label: "soles", region: "americas" },

  // Europa
  EUR: { code: "EUR", symbol: "€", label: "euros", region: "europe" },
  GBP: { code: "GBP", symbol: "£", label: "libras", region: "europe" },
  CHF: { code: "CHF", symbol: "CHF", label: "francos suíços", region: "europe" },
  SEK: { code: "SEK", symbol: "SEK", label: "coroas suecas", region: "europe" },
  NOK: { code: "NOK", symbol: "NOK", label: "coroas norueguesas", region: "europe" },
  DKK: { code: "DKK", symbol: "DKK", label: "coroas dinamarquesas", region: "europe" },
  PLN: { code: "PLN", symbol: "zł", label: "zlotis", region: "europe" },
  CZK: { code: "CZK", symbol: "Kč", label: "coroas tchecas", region: "europe" },
  HUF: { code: "HUF", symbol: "Ft", label: "forints", region: "europe" },
  RON: { code: "RON", symbol: "lei", label: "leus romenos", region: "europe" },

  // Ásia
  JPY: { code: "JPY", symbol: "¥", label: "ienes", region: "asia" },
  CNY: { code: "CNY", symbol: "¥", label: "yuans", region: "asia" },
  KRW: { code: "KRW", symbol: "₩", label: "wons", region: "asia" },
  INR: { code: "INR", symbol: "₹", label: "rúpias", region: "asia" },
  THB: { code: "THB", symbol: "฿", label: "bahts", region: "asia" },
  SGD: { code: "SGD", symbol: "S$", label: "dólares de Singapura", region: "asia" },
  HKD: { code: "HKD", symbol: "HK$", label: "dólares de Hong Kong", region: "asia" },
  TWD: { code: "TWD", symbol: "NT$", label: "dólares taiwaneses", region: "asia" },
  PHP: { code: "PHP", symbol: "₱", label: "pesos filipinos", region: "asia" },
  MYR: { code: "MYR", symbol: "RM", label: "ringgits", region: "asia" },
  IDR: { code: "IDR", symbol: "Rp", label: "rúpias indonésias", region: "asia" },

  // Oceania
  AUD: { code: "AUD", symbol: "A$", label: "dólares australianos", region: "oceania" },
  NZD: { code: "NZD", symbol: "NZ$", label: "dólares neozelandeses", region: "oceania" },

  // Oriente Médio
  AED: { code: "AED", symbol: "AED", label: "dirhams", region: "middle_east" },
  SAR: { code: "SAR", symbol: "SAR", label: "riais sauditas", region: "middle_east" },
  ILS: { code: "ILS", symbol: "₪", label: "shekels", region: "middle_east" },
  TRY: { code: "TRY", symbol: "₺", label: "liras turcas", region: "middle_east" },

  // África
  ZAR: { code: "ZAR", symbol: "R", label: "rands", region: "africa" },
  NGN: { code: "NGN", symbol: "₦", label: "nairas", region: "africa" },
  EGP: { code: "EGP", symbol: "E£", label: "libras egípcias", region: "africa" },
};

/**
 * Mapeia timezone IANA → código de moeda.
 * Cobre as principais zonas; o fallback é USD.
 */
function timezoneToCurrency(tz: string): string {
  // Formato: "Continent/City" ou "Continent/Region/City"
  const parts = tz.split("/");
  const continent = parts[0] ?? "";
  const city = parts[parts.length - 1] ?? "";

  // Mapeamento direto por cidade para casos específicos
  const cityMap: Record<string, string> = {
    // EUA
    New_York: "USD", Chicago: "USD", Denver: "USD", Los_Angeles: "USD",
    Phoenix: "USD", Anchorage: "USD", Honolulu: "USD", Detroit: "USD",
    Indianapolis: "USD", Boise: "USD",
    // Canadá
    Toronto: "CAD", Vancouver: "CAD", Edmonton: "CAD", Winnipeg: "CAD",
    Halifax: "CAD", St_Johns: "CAD", Regina: "CAD",
    // México
    Mexico_City: "MXN", Cancun: "MXN", Tijuana: "MXN", Monterrey: "MXN",
    Merida: "MXN", Chihuahua: "MXN",
    // Brasil
    Sao_Paulo: "BRL", Fortaleza: "BRL", Manaus: "BRL", Belem: "BRL",
    Recife: "BRL", Bahia: "BRL", Cuiaba: "BRL", Porto_Velho: "BRL",
    Rio_Branco: "BRL", Noronha: "BRL", Araguaina: "BRL", Maceio: "BRL",
    Campo_Grande: "BRL", Boa_Vista: "BRL", Eirunepe: "BRL",
    // Argentina
    Buenos_Aires: "ARS", Cordoba: "ARS", Mendoza: "ARS",
    // Chile
    Santiago: "CLP",
    // Colômbia
    Bogota: "COP",
    // Peru
    Lima: "PEN",
    // UK
    London: "GBP", Belfast: "GBP",
    // Suíça
    Zurich: "CHF",
    // Suécia
    Stockholm: "SEK",
    // Noruega
    Oslo: "NOK",
    // Dinamarca
    Copenhagen: "DKK",
    // Polônia
    Warsaw: "PLN",
    // Tchéquia
    Prague: "CZK",
    // Hungria
    Budapest: "HUF",
    // Romênia
    Bucharest: "RON",
    // Japão
    Tokyo: "JPY",
    // China
    Shanghai: "CNY", Hong_Kong: "HKD",
    // Coreia
    Seoul: "KRW",
    // Índia
    Kolkata: "INR", Calcutta: "INR",
    // Tailândia
    Bangkok: "THB",
    // Singapura
    Singapore: "SGD",
    // Taiwan
    Taipei: "TWD",
    // Filipinas
    Manila: "PHP",
    // Malásia
    Kuala_Lumpur: "MYR",
    // Indonésia
    Jakarta: "IDR",
    // Austrália
    Sydney: "AUD", Melbourne: "AUD", Perth: "AUD", Brisbane: "AUD",
    Adelaide: "AUD", Darwin: "AUD", Hobart: "AUD",
    // Nova Zelândia
    Auckland: "NZD",
    // Emirados Árabes
    Dubai: "AED",
    // Arábia Saudita
    Riyadh: "SAR",
    // Israel
    Jerusalem: "ILS", Tel_Aviv: "ILS",
    // Turquia
    Istanbul: "TRY",
    // África do Sul
    Johannesburg: "ZAR",
    // Nigéria
    Lagos: "NGN",
    // Egito
    Cairo: "EGP",
  };

  const cityMatch = cityMap[city];
  if (cityMatch) return cityMatch;

  // Fallback por continente
  const continentMap: Record<string, string> = {
    America: "USD",
    Europe: "EUR",
    Asia: "JPY",
    Australia: "AUD",
    Pacific: "AUD",
    Africa: "ZAR",
    Atlantic: "EUR",
    Indian: "INR",
    Antarctica: "USD",
  };

  return continentMap[continent] ?? "USD";
}

const DEFAULT_CURRENCY: CurrencyInfo = { code: "USD", symbol: "US$", label: "dólares", region: "americas" };

/** Detecta a moeda do visitante (com suporte a override via URL ?currency=USD, ?currency=EUR, etc.) */
export function detectCurrency(): CurrencyInfo {
  try {
    // Permite testar via parâmetro na URL: ?currency=USD ou ?currency=EUR
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const forcedCurrency = params.get("currency")?.toUpperCase();
      if (forcedCurrency && CURRENCY_MAP[forcedCurrency]) {
        return CURRENCY_MAP[forcedCurrency];
      }
    }

    if (typeof Intl === "undefined") return DEFAULT_CURRENCY;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    const code = timezoneToCurrency(tz);
    return CURRENCY_MAP[code] ?? DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

/** Hook React que retorna a moeda detectada (memoizado) */
export function useCurrency(): CurrencyInfo {
  return useMemo(() => detectCurrency(), []);
}

/**
 * Gera os textos de moeda para uso nos componentes.
 * Ex.: currencyTexts(currency) → { heroValue: "€15", heroUnit: "€1", ... }
 */
export function currencyTexts(c: CurrencyInfo) {
  return {
    /** "US$15" / "€15" / "£15" */
    heroValue: `${c.symbol}15`,
    /** "US$1" / "€1" / "£1" */
    heroUnit: `${c.symbol}1`,
    /** "US$15 PARA CADA US$1 INVESTIDO" */
    marqueeRoi: `${c.symbol}15 PARA CADA ${c.symbol}1 INVESTIDO`,
    /** "1.000 (USD/EUR)" → "1.000 (USD)" / "1.000 (EUR)" */
    investLabel: `1.000 ${c.code}`,
    /** Faixa de faturamento prefixo: "(USD/EUR)" → "(USD)" */
    revenueSuffix: `(${c.code})`,
  };
}
