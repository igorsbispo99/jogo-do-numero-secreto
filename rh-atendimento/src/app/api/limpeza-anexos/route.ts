import { NextResponse } from "next/server";
import { DIAS_RETENCAO_ANEXOS } from "@/lib/dominio";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Rotina diária de retenção, disparada pela Vercel (veja vercel.json).
 *
 * Apaga do armazenamento os anexos com mais de 30 dias e os rascunhos de
 * upload que ficaram órfãos - quando alguém escolhe o arquivo mas desiste de
 * enviar a solicitação. O registro do anexo continua no chamado, marcado como
 * removido, para o histórico não ficar com buracos.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOTE = 200;

function autorizado(request: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  // Sem segredo configurado, só a própria Vercel consegue chamar a rota.
  if (!segredo) return request.headers.get("user-agent")?.includes("vercel-cron") ?? false;
  return request.headers.get("authorization") === `Bearer ${segredo}`;
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const limite = new Date(Date.now() - DIAS_RETENCAO_ANEXOS * 24 * 60 * 60_000).toISOString();

  const { data: vencidos, error } = await supabase
    .from("chamado_anexos")
    .select("id, caminho")
    .is("removido_em", null)
    .lt("criado_em", limite)
    .limit(LOTE);

  if (error) {
    console.error("[limpeza] falha ao listar anexos:", error.message);
    return NextResponse.json({ erro: "falha ao listar anexos" }, { status: 500 });
  }

  let apagados = 0;
  if (vencidos && vencidos.length > 0) {
    const { error: erroStorage } = await supabase.storage
      .from("anexos")
      .remove(vencidos.map((a) => a.caminho));

    if (erroStorage) console.error("[limpeza] falha ao apagar arquivos:", erroStorage.message);

    // Mesmo que algum arquivo já não exista, marcamos como removido: o que
    // importa é que ele não está mais guardado.
    const { error: erroMarca } = await supabase
      .from("chamado_anexos")
      .update({ removido_em: new Date().toISOString(), removido_por: "retenção automática" })
      .in(
        "id",
        vencidos.map((a) => a.id),
      );

    if (erroMarca) console.error("[limpeza] falha ao marcar anexos:", erroMarca.message);
    else apagados = vencidos.length;
  }

  // Rascunhos abandonados: arquivo enviado, solicitação nunca concluída.
  let rascunhosApagados = 0;
  const { data: rascunhos } = await supabase.storage
    .from("anexos")
    .list("rascunho", { limit: 500, sortBy: { column: "created_at", order: "asc" } });

  const ontem = Date.now() - 24 * 60 * 60_000;
  const orfaos = (rascunhos ?? [])
    .filter((arquivo) => new Date(arquivo.created_at ?? Date.now()).getTime() < ontem)
    .map((arquivo) => `rascunho/${arquivo.name}`);

  if (orfaos.length > 0) {
    const { error: erroOrfaos } = await supabase.storage.from("anexos").remove(orfaos);
    if (erroOrfaos) console.error("[limpeza] falha nos rascunhos:", erroOrfaos.message);
    else rascunhosApagados = orfaos.length;
  }

  return NextResponse.json({
    ok: true,
    retencao_dias: DIAS_RETENCAO_ANEXOS,
    anexos_apagados: apagados,
    rascunhos_apagados: rascunhosApagados,
    // Havia mais que o lote? A próxima execução continua de onde parou.
    restaram: vencidos?.length === LOTE,
  });
}
