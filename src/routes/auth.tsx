import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import atlasLogo from "@/assets/atlas-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Área da equipe | Assessoria Atlas" },
      { name: "description", content: "Acesso restrito ao CRM interno da Assessoria Atlas." },
      { property: "og:title", content: "Área da equipe | Assessoria Atlas" },
      { property: "og:description", content: "Acesso restrito ao CRM interno da Assessoria Atlas." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/auth" }],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        toast.error("E-mail ou senha inválidos.");
        return;
      }
      navigate({ to: "/crm" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/crm` },
      });
      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Conta criada. Faça login para entrar no CRM.");
      setMode("login");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="panel-metal ring-metal w-full max-w-sm rounded-2xl p-8">
        <img src={atlasLogo.url} alt="Assessoria Atlas" className="atlas-logo mx-auto h-12 w-12 object-contain" />
        <h1 className="mt-6 text-center text-xl font-bold uppercase">CRM Atlas</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {mode === "login" ? "Acesso restrito à equipe" : "Criar acesso da equipe"}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 h-11 bg-surface-2"
            />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 h-11 bg-surface-2"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full font-semibold">
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "login" ? "Criar acesso da equipe" : "Já tenho acesso — entrar"}
        </button>
      </div>
    </div>
  );
}
