import "server-only";
import { headers } from "next/headers";
import { supabaseAdmin } from "./supabase/admin";

export async function ipDoVisitante(): Promise<string> {
  const h = await headers();
  const encaminhado = h.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "desconhecido";
}

/**
 * Freio simples contra força bruta e spam, guardado no próprio Postgres
 * (funciona em serverless, onde memória não é compartilhada entre instâncias).
 * Retorna false quando o limite foi estourado.
 */
export async function registrarTentativa(
  acao: string,
  limite: number,
  janelaMinutos: number,
): Promise<boolean> {
  const supabase = supabaseAdmin();
  const chave = `${acao}:${await ipDoVisitante()}`;
  const desde = new Date(Date.now() - janelaMinutos * 60_000).toISOString();

  const { count } = await supabase
    .from("consulta_tentativas")
    .select("id", { count: "exact", head: true })
    .eq("chave", chave)
    .gte("criado_em", desde);

  await supabase.from("consulta_tentativas").insert({ chave, sucesso: false });

  return (count ?? 0) < limite;
}

/** Limpa tentativas antigas de vez em quando, para a tabela não crescer. */
export async function limparTentativasAntigas(): Promise<void> {
  if (Math.random() > 0.02) return; // ~2% das chamadas
  const supabase = supabaseAdmin();
  const limite = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  await supabase.from("consulta_tentativas").delete().lt("criado_em", limite);
}
