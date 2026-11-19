/**
 * O que acontece com os prazos quando o status do chamado muda.
 *
 * - "Aguardando colaborador" e "Resolvido" param o relógio da resolução: o RH
 *   não pode ser cobrado pelo tempo em que depende da outra pessoa.
 * - Quando o chamado volta a andar, o prazo de resolução é empurrado pelas
 *   horas úteis em que ficou parado.
 * - `sla_proximo_prazo` guarda o próximo prazo que vale (1ª resposta enquanto
 *   ela não sai, depois a resolução). É ele que ordena a fila por prazo.
 */

import { minutosUteisEntre, somarMinutosUteis } from "./calendario";

export type EstadoSla = {
  status: string;
  primeira_resposta_em: string | null;
  sla_primeira_resposta_ate: string | null;
  sla_resolucao_ate: string | null;
  sla_pausado_desde: string | null;
  sla_minutos_pausados?: number | null;
};

export type ColunasTransicao = {
  sla_pausado_desde?: string | null;
  sla_resolucao_ate?: string | null;
  sla_minutos_pausados?: number;
  sla_proximo_prazo: string | null;
};

const PARADO = new Set(["aguardando_colaborador", "resolvido"]);

export const relogioParado = (status: string) => PARADO.has(status);

export function proximoPrazo(c: EstadoSla): string | null {
  if (c.status === "cancelado" || c.status === "resolvido") return null;
  if (!c.primeira_resposta_em && c.sla_primeira_resposta_ate) return c.sla_primeira_resposta_ate;
  if (c.sla_pausado_desde) return null;
  return c.sla_resolucao_ate;
}

/** Colunas de SLA a gravar quando o status muda (ou a 1ª resposta sai). */
export function transicaoSla(
  atual: EstadoSla,
  mudanca: { status?: string; primeiraRespostaEm?: string | null },
  agora: Date,
): ColunasTransicao | null {
  if (!atual.sla_resolucao_ate) return null;

  const novo: EstadoSla = {
    ...atual,
    status: mudanca.status ?? atual.status,
    primeira_resposta_em: atual.primeira_resposta_em ?? mudanca.primeiraRespostaEm ?? null,
  };
  const colunas: ColunasTransicao = { sla_proximo_prazo: null };

  if (relogioParado(novo.status) && !atual.sla_pausado_desde) {
    novo.sla_pausado_desde = agora.toISOString();
    colunas.sla_pausado_desde = novo.sla_pausado_desde;
  } else if (!relogioParado(novo.status) && atual.sla_pausado_desde) {
    const parado = minutosUteisEntre(new Date(atual.sla_pausado_desde), agora);
    novo.sla_resolucao_ate = somarMinutosUteis(new Date(atual.sla_resolucao_ate), parado).toISOString();
    novo.sla_pausado_desde = null;
    colunas.sla_pausado_desde = null;
    colunas.sla_resolucao_ate = novo.sla_resolucao_ate;
    colunas.sla_minutos_pausados = (atual.sla_minutos_pausados ?? 0) + parado;
  }

  colunas.sla_proximo_prazo = proximoPrazo(novo);
  return colunas;
}

export type SituacaoPrazo = "vencido" | "hoje" | "no_prazo" | "feito" | "pausado" | "sem";

/** Situação de um prazo para exibir na fila e nos e-mails. */
export function situacaoDoPrazo(
  prazo: string | null,
  cumpridoEm: string | null,
  agora: Date,
  fimDeHoje: Date,
  pausado = false,
): SituacaoPrazo {
  if (!prazo) return "sem";
  if (cumpridoEm) return "feito";
  if (pausado) return "pausado";
  const data = new Date(prazo);
  if (data < agora) return "vencido";
  if (data <= fimDeHoje) return "hoje";
  return "no_prazo";
}
