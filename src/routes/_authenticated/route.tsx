import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    // Em dev local, permite visualizar o CRM como prévia se não houver usuário logado
    if ((error || !data.user) && import.meta.env.PROD) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user ?? { id: "demo-user", email: "equipe@atlas.com" } };
  },
  component: () => <Outlet />,
});
