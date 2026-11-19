import "server-only";
import { tituloVinculo } from "../catalogo";
import { emailChamadoCritico } from "../email";
import { formatarPrazo } from "../format";
import { supabaseAdmin } from "../supabase/admin";
import { previaSla, type ResultadoSla } from "./calcular";
import { somarMinutosUteis } from "./calendario";
import { proximoPrazo, transicaoSla, type EstadoSla } from "./estado";
import { AGRAVANTES, NIVEIS_SLA, type AgravanteId } from "./regras";

/**
 * Tudo o que grava SLA no banco passa por aqui.
 *
 * Cada função faz o próprio select/update e engole o erro (com log): abrir,
 * responder ou mudar o status de um chamado nunca pode falhar por causa do
 * SLA - por exemplo, entre o deploy do código e a migração no SQL Editor.
 */

export const COLUNAS_ESTADO_SLA =
  "status, primeira_resposta_em, sla_primeira_resposta_ate, sla_resolucao_ate, sla_pausado_desde, sla_minutos_pausados";

export async function destinatarios(papeis: ("gestao" | "triagem")[]): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("notificacao_destinatarios")
      .select("email")
      .eq("ativo", true)
      .in("papel", papeis);
    if (error) throw error;
    return [...new Set((data ?? []).map((d) => d.email.trim().toLowerCase()))];
  } catch (erro) {
    console.error("[sla] não consegui ler os destinatários:", erro);
    return [];
  }
}

/** Motivo do nível, em uma frase, para o aviso de Crítico. */
function motivoPrincipal(resultado: ResultadoSla): string {
  const efetivo = [...resultado.motivos].reverse().find((m) => !m.semEfeito && m.nivel === resultado.nivel);
  return (efetivo ?? resultado.motivos[0]).texto;
}

export async function avisarCritico(dados: {
  chamadoId: string;
  protocolo: string;
  assunto: string;
  vinculo: string;
  resultado: ResultadoSla;
  origem: "previa" | "revisao";
}): Promise<void> {
  const para = await destinatarios(["gestao", "triagem"]);
  if (para.length === 0) return;
  await emailChamadoCritico({
    para,
    protocolo: dados.protocolo,
    assunto: dados.assunto,
    vinculo: tituloVinculo(dados.vinculo),
    motivo: motivoPrincipal(dados.resultado),
    primeiraRespostaAte: formatarPrazo(dados.resultado.primeiraRespostaAte),
    chamadoId: dados.chamadoId,
    origem: dados.origem,
  });
}

/**
 * Colunas que um resultado de SLA grava no chamado. Numa reclassificação, o
 * tempo em que o chamado já ficou parado (aguardando o colaborador) continua
 * empurrando o prazo de resolução.
 */
export function colunasDoResultado(resultado: ResultadoSla, minutosPausados = 0) {
  const resolucao =
    minutosPausados > 0 ? somarMinutosUteis(resultado.resolucaoAte, minutosPausados) : resultado.resolucaoAte;
  return {
    sla_nivel: resultado.nivel,
    sla_variante: resultado.variante,
    sla_agravantes: resultado.agravantes,
    sla_primeira_resposta_ate: resultado.primeiraRespostaAte.toISOString(),
    sla_resolucao_ate: resolucao.toISOString(),
    prioridade: NIVEIS_SLA[resultado.nivel].prioridade,
  };
}

/**
 * Calcula e grava a prévia de um chamado que acabou de chegar.
 * Devolve o resultado, ou null se não deu para gravar.
 */
export async function aplicarPrevia(chamado: {
  id: string;
  protocolo: string;
  vinculo: string;
  categoria: string;
  subcategoria: string;
  assunto: string;
  dadosExtras: Record<string, string>;
  descricao: string;
  cpf: string;
  criadoEm: Date;
}): Promise<ResultadoSla | null> {
  try {
    const supabase = supabaseAdmin();

    // Mesmo CPF e mesmo assunto nos últimos 30 dias: é reincidência.
    const desde = new Date(chamado.criadoEm.getTime() - 30 * 24 * 60 * 60_000).toISOString();
    const { count } = await supabase
      .from("chamados")
      .select("id", { count: "exact", head: true })
      .eq("solicitante_cpf", chamado.cpf)
      .eq("categoria", chamado.categoria)
      .eq("subcategoria", chamado.subcategoria)
      .eq("de_teste", false)
      .neq("id", chamado.id)
      .gte("criado_em", desde);

    const { resultado, sugestoes } = previaSla({
      vinculo: chamado.vinculo,
      categoria: chamado.categoria,
      subcategoria: chamado.subcategoria,
      dadosExtras: chamado.dadosExtras,
      abertoEm: chamado.criadoEm,
      texto: chamado.descricao,
      reincidente: (count ?? 0) > 0,
    });

    const colunas = colunasDoResultado(resultado);
    const { error } = await supabase
      .from("chamados")
      .update({
        ...colunas,
        sla_proximo_prazo: colunas.sla_primeira_resposta_ate,
        sla_previa_nivel: resultado.nivel,
        sla_previa_variante: resultado.variante,
        sla_previa_agravantes: resultado.agravantes,
        sla_sugestoes: sugestoes,
      })
      .eq("id", chamado.id);
    if (error) throw error;

    await supabase.from("chamado_eventos").insert({
      chamado_id: chamado.id,
      autor_nome: "Sistema",
      descricao: `Prévia de SLA: ${NIVEIS_SLA[resultado.nivel].titulo} · 1ª resposta até ${formatarPrazo(resultado.primeiraRespostaAte)} · resolução até ${formatarPrazo(resultado.resolucaoAte)}`,
      publico: false,
    });

    if (resultado.nivel === "critica") {
      await avisarCritico({
        chamadoId: chamado.id,
        protocolo: chamado.protocolo,
        assunto: chamado.assunto,
        vinculo: chamado.vinculo,
        resultado,
        origem: "previa",
      });
    }
    return resultado;
  } catch (erro) {
    console.error("[sla] prévia não gravada (rode supabase/schema.sql se for coluna ausente):", erro);
    return null;
  }
}

/**
 * Ajusta pausa e próximo prazo depois de uma mudança de status ou da 1ª
 * resposta. Chamada depois do update do chamado, por isso recebe o status
 * que ele tinha antes.
 */
export async function registrarTransicao(
  chamadoId: string,
  mudanca: { statusAnterior: string; status?: string; primeiraRespostaEm?: string | null },
): Promise<void> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("chamados")
      .select(COLUNAS_ESTADO_SLA)
      .eq("id", chamadoId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return;

    const atual = { ...(data as EstadoSla), status: mudanca.statusAnterior };
    if (mudanca.primeiraRespostaEm) atual.primeira_resposta_em = null;
    const colunas = transicaoSla(
      atual,
      { status: mudanca.status, primeiraRespostaEm: mudanca.primeiraRespostaEm },
      new Date(),
    );
    if (!colunas) return;
    const { error: erroUpdate } = await supabase.from("chamados").update(colunas).eq("id", chamadoId);
    if (erroUpdate) throw erroUpdate;
  } catch (erro) {
    console.error("[sla] transição não gravada:", erro);
  }
}

export { proximoPrazo };

export const tituloAgravante = (id: AgravanteId) => AGRAVANTES.find((a) => a.id === id)?.titulo ?? id;
