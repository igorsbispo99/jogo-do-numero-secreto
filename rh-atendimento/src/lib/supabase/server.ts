import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookiesParaGravar = { name: string; value: string; options: CookieOptions }[];

/** Cliente autenticado com a sessão do agente de RH (respeita RLS). */
export async function supabaseServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookiesParaGravar) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado a partir de um Server Component: o middleware já renova
            // a sessão, então pode ignorar.
          }
        },
      },
    },
  );
}

export type AgenteRh = {
  id: string;
  nome: string;
  email: string;
  papel: "admin" | "agente";
};

/** Devolve o agente logado, ou null se não houver sessão válida. */
export async function agenteAtual(): Promise<AgenteRh | null> {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("rh_usuarios")
    .select("id, nome, email, papel, ativo")
    .eq("id", user.id)
    .maybeSingle();

  if (!data || !data.ativo) return null;
  return { id: data.id, nome: data.nome, email: data.email, papel: data.papel };
}

/** Igual ao anterior, mas estoura erro - para uso dentro de server actions. */
export async function exigirAgente(): Promise<AgenteRh> {
  const agente = await agenteAtual();
  if (!agente) throw new Error("Sessão expirada. Faça login novamente.");
  return agente;
}
