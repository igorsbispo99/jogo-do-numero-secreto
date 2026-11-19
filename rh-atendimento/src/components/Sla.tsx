import { formatarPrazo, tempoAtePrazo } from "@/lib/format";
import { situacaoDoPrazo, type SituacaoPrazo } from "@/lib/sla/estado";
import { NIVEIS_SLA, nivelValido } from "@/lib/sla/regras";

/** Cores por nível de SLA: fundo pastel + texto escuro da mesma cor da marca. */
export const COR_NIVEL: Record<string, string> = {
  critica: "bg-tea-vinho-100 text-tea-vinho-800 ring-tea-vinho-500/30",
  alta: "bg-tea-laranja-100 text-tea-laranja-800 ring-tea-laranja-500/30",
  normal: "bg-tea-turquesa-100 text-tea-turquesa-800 ring-tea-turquesa-500/25",
  planejada: "bg-tea-azul-100 text-tea-azul-800 ring-tea-azul-500/25",
};

export function EtiquetaNivel({ nivel }: { nivel: string | null | undefined }) {
  if (!nivelValido(nivel)) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${COR_NIVEL[nivel]}`}
    >
      {NIVEIS_SLA[nivel].titulo}
    </span>
  );
}

export function EtiquetaAConfirmar() {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-slate-400 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
      SLA a confirmar
    </span>
  );
}

const ESTILO_SITUACAO: Record<SituacaoPrazo, string> = {
  vencido: "bg-tea-vinho-600 text-white",
  hoje: "bg-tea-ambar-100 text-tea-ambar-800 ring-1 ring-inset ring-tea-ambar-500/40",
  no_prazo: "bg-tea-turquesa-50 text-tea-turquesa-800",
  feito: "bg-slate-100 text-slate-600",
  pausado: "bg-white text-slate-600 ring-1 ring-inset ring-slate-300",
  sem: "bg-slate-50 text-slate-500",
};

function ChipPrazo({ situacao, texto }: { situacao: SituacaoPrazo; texto: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTILO_SITUACAO[situacao]}`}
    >
      {texto}
    </span>
  );
}

export type PrazosDoChamado = {
  status: string;
  primeira_resposta_em: string | null;
  sla_primeira_resposta_ate?: string | null;
  sla_resolucao_ate?: string | null;
  sla_pausado_desde?: string | null;
  resolvido_em?: string | null;
};

/** Os dois prazos de um chamado, compactos, para a linha da fila. */
export function PrazosNaFila({
  chamado,
  agora,
  fimDeHoje,
}: {
  chamado: PrazosDoChamado;
  agora: Date;
  fimDeHoje: Date;
}) {
  if (!chamado.sla_primeira_resposta_ate) {
    return <p className="text-xs text-slate-400">Sem prazos calculados</p>;
  }

  const encerrado = chamado.status === "resolvido" || chamado.status === "cancelado";
  const resposta = situacaoDoPrazo(
    chamado.sla_primeira_resposta_ate,
    chamado.primeira_resposta_em,
    agora,
    fimDeHoje,
  );
  const resolucao = situacaoDoPrazo(
    chamado.sla_resolucao_ate ?? null,
    encerrado ? (chamado.resolvido_em ?? "encerrado") : null,
    agora,
    fimDeHoje,
    Boolean(chamado.sla_pausado_desde),
  );

  const textoResposta =
    resposta === "feito"
      ? "Respondida"
      : resposta === "vencido"
        ? tempoAtePrazo(chamado.sla_primeira_resposta_ate, agora).replace("vencido", "Vencida")
        : `Até ${formatarPrazo(chamado.sla_primeira_resposta_ate)}`;
  const textoResolucao =
    resolucao === "feito"
      ? chamado.status === "cancelado"
        ? "Cancelado"
        : "Resolvido"
      : resolucao === "pausado"
        ? "Pausada: aguardando colaborador"
        : resolucao === "vencido"
          ? tempoAtePrazo(chamado.sla_resolucao_ate!, agora).replace("vencido", "Vencida")
          : `Até ${formatarPrazo(chamado.sla_resolucao_ate)}`;

  return (
    <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-2.5 gap-y-1.5 text-xs">
      <dt className="text-slate-500">1ª resposta</dt>
      <dd>
        <ChipPrazo situacao={resposta} texto={textoResposta} />
      </dd>
      <dt className="text-slate-500">Resolução</dt>
      <dd>
        <ChipPrazo situacao={resolucao} texto={textoResolucao} />
      </dd>
    </dl>
  );
}
