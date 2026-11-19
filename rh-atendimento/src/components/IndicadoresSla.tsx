import Link from "next/link";
import { EtiquetaNivel } from "@/components/Sla";
import { rotuloAssunto, type VinculoSlug } from "@/lib/catalogo";
import { STATUS_ABERTOS } from "@/lib/dominio";
import { NIVEIS_SLA, ORDEM_NIVEIS, nivelValido, rankNivel } from "@/lib/sla/regras";
import { supabaseServidor } from "@/lib/supabase/server";

/** Critério para um assunto dispensar a confirmação humana do SLA. */
export const CRITERIO_DISPENSA = { minimo: 30, acerto: 0.95 };

type Linha = {
  vinculo: VinculoSlug;
  categoria: string;
  subcategoria: string;
  status: string;
  primeira_resposta_em: string | null;
  resolvido_em: string | null;
  sla_nivel: string | null;
  sla_previa_nivel: string | null;
  sla_previa_correta: boolean | null;
  sla_previa_agravantes_corretos: boolean | null;
  sla_primeira_resposta_ate: string | null;
  sla_resolucao_ate: string | null;
};

const pct = (parte: number, total: number) => (total ? `${Math.round((parte / total) * 100)}%` : "-");

/**
 * Indicadores de SLA: prazos cumpridos e o quanto a prévia automática acerta.
 * Consulta própria, para não mexer nos cálculos do resto da página.
 */
export async function IndicadoresSla({
  inicio,
  vinculo,
  unidade,
}: {
  inicio: Date | null;
  vinculo?: string;
  unidade?: string;
}) {
  const supabase = await supabaseServidor();
  let consulta = supabase
    .from("chamados")
    .select(
      "vinculo, categoria, subcategoria, status, primeira_resposta_em, resolvido_em, sla_nivel, sla_previa_nivel, sla_previa_correta, sla_previa_agravantes_corretos, sla_primeira_resposta_ate, sla_resolucao_ate",
    )
    .eq("de_teste", false)
    .not("sla_nivel", "is", null)
    .limit(10000);
  if (inicio) consulta = consulta.gte("criado_em", inicio.toISOString());
  if (vinculo) consulta = consulta.eq("vinculo", vinculo);
  if (unidade) consulta = consulta.eq("unidade", unidade);

  let vencidosAgora = supabase
    .from("chamados")
    .select("id", { count: "exact", head: true })
    .eq("de_teste", false)
    .in("status", STATUS_ABERTOS)
    .lt("sla_proximo_prazo", new Date().toISOString());
  if (vinculo) vencidosAgora = vencidosAgora.eq("vinculo", vinculo);
  if (unidade) vencidosAgora = vencidosAgora.eq("unidade", unidade);

  const [{ data, error }, vencidos] = await Promise.all([consulta, vencidosAgora]);

  if (error) {
    return (
      <section className="cartao mt-6 p-5">
        <h2 className="text-sm font-bold text-slate-900">Prazos de SLA</h2>
        <p className="mt-2 text-sm text-slate-500">
          Os indicadores de SLA aparecem depois que o banco recebe a atualização (supabase/schema.sql).
        </p>
      </section>
    );
  }

  const linhas = (data ?? []) as Linha[];
  const respondidos = linhas.filter((l) => l.primeira_resposta_em && l.sla_primeira_resposta_ate);
  const respostaNoPrazo = respondidos.filter(
    (l) => new Date(l.primeira_resposta_em!) <= new Date(l.sla_primeira_resposta_ate!),
  );
  const resolvidos = linhas.filter((l) => l.resolvido_em && l.sla_resolucao_ate && l.status === "resolvido");
  const resolucaoNoPrazo = resolvidos.filter((l) => new Date(l.resolvido_em!) <= new Date(l.sla_resolucao_ate!));

  const avaliados = linhas.filter((l) => l.sla_previa_correta !== null);
  const acertos = avaliados.filter((l) => l.sla_previa_correta);
  const agravantesCertos = avaliados.filter((l) => l.sla_previa_agravantes_corretos);
  const abaixo = (l: Linha) =>
    nivelValido(l.sla_previa_nivel) && nivelValido(l.sla_nivel) && rankNivel(l.sla_previa_nivel) < rankNivel(l.sla_nivel);
  const subestimados = avaliados.filter(abaixo);

  const porNivel = [...ORDEM_NIVEIS].reverse().map((n) => ({ nivel: n, total: linhas.filter((l) => l.sla_nivel === n).length }));

  const porAssunto = new Map<string, { total: number; acertos: number; abaixo: number }>();
  for (const l of avaliados) {
    const chave = rotuloAssunto(l.vinculo, l.categoria, l.subcategoria);
    const item = porAssunto.get(chave) ?? { total: 0, acertos: 0, abaixo: 0 };
    item.total += 1;
    if (l.sla_previa_correta) item.acertos += 1;
    if (abaixo(l)) item.abaixo += 1;
    porAssunto.set(chave, item);
  }
  const assuntos = [...porAssunto.entries()].sort((a, b) => b[1].total - a[1].total);

  const situacao = (item: { total: number; acertos: number; abaixo: number }) => {
    if (item.abaixo > 0) return { texto: "Manter confirmação: a prévia já ficou abaixo", cor: "text-tea-vinho-700" };
    if (item.total < CRITERIO_DISPENSA.minimo) {
      return { texto: `Coletando dados (${item.total} de ${CRITERIO_DISPENSA.minimo})`, cor: "text-slate-500" };
    }
    if (item.acertos / item.total >= CRITERIO_DISPENSA.acerto) {
      return { texto: "Pode dispensar a confirmação", cor: "text-tea-turquesa-700" };
    }
    return { texto: "Manter confirmação: acerto abaixo de 95%", cor: "text-tea-ambar-800" };
  };

  const blocos = [
    { titulo: "1ª resposta no prazo", valor: pct(respostaNoPrazo.length, respondidos.length), detalhe: `${respostaNoPrazo.length} de ${respondidos.length} respondidos` },
    { titulo: "Resolução no prazo", valor: pct(resolucaoNoPrazo.length, resolvidos.length), detalhe: `${resolucaoNoPrazo.length} de ${resolvidos.length} resolvidos` },
    { titulo: "Vencidos agora", valor: String(vencidos.count ?? 0), detalhe: "Chamados em aberto com prazo vencido", href: "/rh?prazo=vencidos&ordem=prazo" },
    { titulo: "Acerto da prévia", valor: pct(acertos.length, avaliados.length), detalhe: `Nível certo em ${acertos.length} de ${avaliados.length} confirmados` },
    { titulo: "Agravantes certos", valor: pct(agravantesCertos.length, avaliados.length), detalhe: "Prévia marcou exatamente os mesmos" },
    { titulo: "Prévia abaixo do oficial", valor: String(subestimados.length), detalhe: "O erro que importa: risco subestimado" },
  ];

  return (
    <section className="cartao mt-6 space-y-5 p-5" aria-labelledby="indicadores-sla">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="indicadores-sla" className="text-sm font-bold text-slate-900">
          Prazos de SLA e prévia automática
        </h2>
        <Link href="/rh/sla" className="text-xs font-semibold text-tea-turquesa-700 hover:underline">
          Ver as regras
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {blocos.map((b) => {
          const conteudo = (
            <>
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{b.titulo}</span>
              <span className="mt-1 block text-2xl font-bold text-tea-marinho">{b.valor}</span>
              <span className="block text-xs text-slate-500">{b.detalhe}</span>
            </>
          );
          return b.href ? (
            <Link key={b.titulo} href={b.href} className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
              {conteudo}
            </Link>
          ) : (
            <div key={b.titulo} className="rounded-lg border border-slate-200 p-4">
              {conteudo}
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Chamados por criticidade</h3>
        <div className="mt-2 flex flex-wrap gap-3">
          {porNivel.map(({ nivel, total }) => (
            <Link
              key={nivel}
              href={`/rh?status=todos&criticidade=${nivel}`}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <EtiquetaNivel nivel={nivel} />
              <span className="font-bold text-slate-900">{total}</span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Acerto da prévia por assunto</h3>
        <p className="mt-1 text-xs text-slate-500">
          Um assunto pode dispensar a confirmação humana com pelo menos {CRITERIO_DISPENSA.minimo} chamados
          confirmados, {Math.round(CRITERIO_DISPENSA.acerto * 100)}% ou mais de acerto do nível e nenhuma prévia abaixo
          do nível oficial. Use o período “Desde o início” para a avaliação completa. Chamados Críticos sempre
          passam por uma pessoa.
        </p>
        {assuntos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nenhum SLA confirmado no período ainda.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Assunto</th>
                  <th className="py-2 pr-4">Confirmados</th>
                  <th className="py-2 pr-4">Acerto do nível</th>
                  <th className="py-2 pr-4">Abaixo do oficial</th>
                  <th className="py-2">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assuntos.map(([assunto, item]) => {
                  const s = situacao(item);
                  return (
                    <tr key={assunto}>
                      <td className="py-2 pr-4 text-slate-800">{assunto}</td>
                      <td className="py-2 pr-4">{item.total}</td>
                      <td className="py-2 pr-4">{pct(item.acertos, item.total)}</td>
                      <td className="py-2 pr-4">{item.abaixo}</td>
                      <td className={`py-2 font-semibold ${s.cor}`}>{s.texto}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Níveis: {[...ORDEM_NIVEIS].reverse().map((n) => NIVEIS_SLA[n].titulo).join(", ")}. Contam os chamados abertos no
        período selecionado.
      </p>
    </section>
  );
}
