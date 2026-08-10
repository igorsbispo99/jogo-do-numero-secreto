import { corPrioridade, corStatus, tituloPrioridade, tituloStatus } from "@/lib/dominio";

export function EtiquetaStatus({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${corStatus(status)}`}
    >
      {tituloStatus(status)}
    </span>
  );
}

export function EtiquetaPrioridade({ prioridade }: { prioridade: string }) {
  if (prioridade === "normal" || prioridade === "baixa") return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${corPrioridade(prioridade)}`}
    >
      {tituloPrioridade(prioridade)}
    </span>
  );
}

/* Cada vínculo tem sua cor da marca, para bater o olho e reconhecer na fila. */
const VINCULO_VISUAL: Record<string, { titulo: string; cor: string }> = {
  pj: { titulo: "PJ", cor: "bg-tea-azul-100 text-tea-azul-800 ring-tea-azul-500/25" },
  clt: {
    titulo: "CLT",
    cor: "bg-tea-turquesa-100 text-tea-turquesa-800 ring-tea-turquesa-500/25",
  },
  estagio: {
    titulo: "Estágio",
    cor: "bg-tea-ambar-100 text-tea-ambar-800 ring-tea-ambar-500/30",
  },
};

export function EtiquetaVinculo({ vinculo }: { vinculo: string }) {
  const visual = VINCULO_VISUAL[vinculo];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        visual?.cor ?? "bg-slate-100 text-slate-700 ring-slate-500/20"
      }`}
    >
      {visual?.titulo ?? vinculo}
    </span>
  );
}
