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

export function EtiquetaVinculo({ vinculo }: { vinculo: string }) {
  const titulos: Record<string, string> = { pj: "PJ", clt: "CLT", estagio: "Estágio" };
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-500/20">
      {titulos[vinculo] ?? vinculo}
    </span>
  );
}
