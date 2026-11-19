import Link from "next/link";
import { calcularSlaChamado } from "@/actions/rh";
import { EtiquetaAConfirmar, EtiquetaNivel } from "@/components/Sla";
import { formatarDataHora, formatarPrazo, tempoAtePrazo } from "@/lib/format";
import { calcularSla } from "@/lib/sla/calcular";
import { NIVEIS_SLA, nivelValido } from "@/lib/sla/regras";
import type { Chamado } from "@/lib/tipos";

/**
 * Quadro "Prazos do chamado": nível, os dois prazos com contagem, o que
 * conta como resolvido e por que o chamado ficou nesse nível.
 */
export function PainelSla({
  chamado,
  confirmadoPor,
  agora,
}: {
  chamado: Chamado;
  confirmadoPor: string | null;
  agora: Date;
}) {
  if (!chamado.sla_nivel || !chamado.sla_primeira_resposta_ate || !chamado.sla_resolucao_ate) {
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Prazos do chamado</h2>
          <p className="mt-1 text-sm text-slate-500">
            Este chamado chegou antes da regra de SLA. Calcule os prazos a partir da data de abertura.
          </p>
        </div>
        <form action={calcularSlaChamado}>
          <input type="hidden" name="chamadoId" value={chamado.id} />
          <button type="submit" className="botao-secundario">
            Calcular prazos
          </button>
        </form>
      </div>
    );
  }

  const nivel = nivelValido(chamado.sla_nivel) ? chamado.sla_nivel : "normal";
  // Recalcula só para mostrar a explicação: os prazos exibidos são os gravados.
  const explicacao = calcularSla({
    vinculo: chamado.vinculo,
    categoria: chamado.categoria,
    subcategoria: chamado.subcategoria,
    dadosExtras: chamado.dados_extras,
    abertoEm: new Date(chamado.criado_em),
    agravantes: chamado.sla_agravantes ?? [],
    variante: chamado.sla_variante,
    nivelManual: chamado.sla_nivel_manual,
    texto: chamado.descricao,
  });

  const encerrado = chamado.status === "resolvido" || chamado.status === "cancelado";
  const respostaAte = new Date(chamado.sla_primeira_resposta_ate);
  const resolucaoAte = new Date(chamado.sla_resolucao_ate);

  const resposta = chamado.primeira_resposta_em
    ? {
        tom: new Date(chamado.primeira_resposta_em) <= respostaAte ? "ok" : "atrasado",
        linha:
          new Date(chamado.primeira_resposta_em) <= respostaAte
            ? `Respondida em ${formatarDataHora(chamado.primeira_resposta_em)}, no prazo`
            : `Respondida em ${formatarDataHora(chamado.primeira_resposta_em)}, fora do prazo`,
      }
    : { tom: respostaAte < agora ? "atrasado" : "aberto", linha: tempoAtePrazo(respostaAte, agora) };

  const resolucao = encerrado
    ? {
        tom: chamado.resolvido_em && new Date(chamado.resolvido_em) <= resolucaoAte ? "ok" : "neutro",
        linha:
          chamado.status === "cancelado"
            ? "Chamado cancelado"
            : chamado.resolvido_em
              ? `Resolvido em ${formatarDataHora(chamado.resolvido_em)}${new Date(chamado.resolvido_em) <= resolucaoAte ? ", no prazo" : ", fora do prazo"}`
              : "Resolvido",
      }
    : chamado.sla_pausado_desde
      ? {
          tom: "neutro",
          linha: `Pausado desde ${formatarDataHora(chamado.sla_pausado_desde)}: aguardando o colaborador`,
        }
      : { tom: resolucaoAte < agora ? "atrasado" : "aberto", linha: tempoAtePrazo(resolucaoAte, agora) };

  const caixa = (tom: string) =>
    tom === "atrasado"
      ? "border-tea-vinho-200 bg-tea-vinho-50"
      : tom === "ok"
        ? "border-tea-turquesa-200 bg-tea-turquesa-50"
        : tom === "aberto"
          ? "border-tea-ambar-200 bg-tea-ambar-50"
          : "border-slate-200 bg-slate-50";

  return (
    <section className="mt-6 space-y-4 border-t border-slate-100 pt-5" aria-labelledby="prazos-chamado">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="prazos-chamado" className="text-sm font-bold text-slate-900">
            Prazos do chamado
          </h2>
          <EtiquetaNivel nivel={nivel} />
          {!chamado.sla_confirmado_em && <EtiquetaAConfirmar />}
        </div>
        <p className="text-xs text-slate-500">
          {chamado.sla_confirmado_em
            ? `Confirmado por ${confirmadoPor ?? "RH"} em ${formatarDataHora(chamado.sla_confirmado_em)}`
            : "Prévia automática. Confirme ou revise ao lado."}
        </p>
      </div>

      {nivel === "critica" && !encerrado && (
        <p className="rounded-lg border border-tea-vinho-200 bg-tea-vinho-50 px-4 py-3 text-sm text-slate-800">
          <strong className="text-tea-vinho-700">Escale agora.</strong> Avise o Head de RH por telefone ou
          mensagem e registre no chamado. Se houver paciente envolvido, avise também a coordenação da unidade.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`rounded-lg border px-4 py-3 ${caixa(resposta.tom)}`}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">1ª resposta até</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{formatarPrazo(respostaAte)}</p>
          <p className="text-sm font-medium text-slate-700">{resposta.linha}</p>
          <p className="mt-1 text-xs text-slate-500">{NIVEIS_SLA[nivel].regraResposta}</p>
        </div>
        <div className={`rounded-lg border px-4 py-3 ${caixa(resolucao.tom)}`}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Resolução até</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{formatarPrazo(resolucaoAte)}</p>
          <p className="text-sm font-medium text-slate-700">{resolucao.linha}</p>
          <p className="mt-1 text-xs text-slate-500">
            {explicacao.regraResolucao}
            {(chamado.sla_minutos_pausados ?? 0) > 0 && " · prazo estendido pelo tempo aguardando o colaborador"}
          </p>
        </div>
      </div>

      {(explicacao.entrega || explicacao.alerta || explicacao.dica) && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {explicacao.alerta && (
            <p>
              <strong className="text-tea-vinho-700">Atenção:</strong> {explicacao.alerta}
            </p>
          )}
          {explicacao.entrega && (
            <p>
              <strong>Para dar como resolvido:</strong> {explicacao.entrega}
            </p>
          )}
          {explicacao.dica && <p className="text-slate-600">{explicacao.dica}</p>}
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-slate-600 hover:text-tea-turquesa-700">
          Por que esse nível
        </summary>
        <ul className="mt-2 space-y-1.5">
          {explicacao.motivos.map((m, i) => (
            <li key={i} className={`flex items-start gap-2 ${m.semEfeito ? "text-slate-400" : "text-slate-700"}`}>
              <EtiquetaNivel nivel={m.nivel} />
              <span>{m.texto}</span>
            </li>
          ))}
          {chamado.sla_justificativa && (
            <li className="text-slate-700">Justificativa do ajuste: {chamado.sla_justificativa}</li>
          )}
        </ul>
        <Link href="/rh/sla" className="mt-2 inline-block text-xs font-semibold text-tea-turquesa-700 hover:underline">
          Ver todas as regras na calculadora
        </Link>
      </details>
    </section>
  );
}
