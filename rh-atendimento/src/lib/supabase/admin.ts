import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente com service role. Usado SOMENTE no servidor, para o que o público
 * precisa fazer sem estar logado (abrir chamado e consultar por protocolo).
 * Ele ignora RLS, então nenhuma função aqui pode receber filtro vindo do
 * navegador sem validação.
 */
let cache: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cache) return cache;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.",
    );
  }

  cache = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cache;
}
