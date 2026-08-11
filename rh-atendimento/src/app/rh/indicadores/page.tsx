import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CabecalhoRh } from "@/components/CabecalhoRh";
import { Barras } from "@/components/graficos/Barras";
import { Rosca } from "@/components/graficos/Rosca";
import { Tendencia } from "@/components/graficos/Tendencia";
import { rotuloAssunto, tituloVinculo, VINCULOS, type VinculoSlug } from "@/lib/catalogo";
import { STATUS_ABERTOS, tituloStatus } from "@/lib/dominio";
import { formatarBytes, formatarData } from "@/lib/format";
import { COR_POR_STATUS, corDaSerie, type Ponto } from "@/lib/graficos";
import { agenteAtual, supabaseServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Indicadores · RH Grupo TEA" };
export const dynamic = "force-dynamic";

const COTA_ARMAZENAMENTO = 1024 * 1024 * 1024;
const LIMITE_LEITURA = 10000;

const PERIODOS = [
  { slug: "30", titulo: "30 dias", dias: 30, granularidade: "dia" as const },
  { slug: "90", titulo: "90 dias", dias: 90, granularidade: "semana" as const },
  { slug: "365", titulo: "12 meses", dias: 365, granularidade: "mes" as const },
  { slug: "tudo", titulo: "Desde o início", dias: 0, granularidade: "mes" as const },
];

type LinhaChamado = {
  id: string;
  protocolo: string;
  status: string;
  vinculo: VinculoSlug;
  categoria: string;
  subcategoria: string;
  unidade: string | null;
  responsavel_id: string | null;
  criado_em: string;
  primeira_resposta_em: string | null;
  resolvido_em: string | null;
};

// ---------------------------------------------------------------------------
// Cálculos
// ---------------------------------------------------------------------------

const horasEntre = (de: string, ate: string) =>
  (new Date(ate).getTime() - new Date(de).getTime()) / 3_600_000;

/** Data já no fuso de Brasília, para os agrupamentos por dia não escorregarem. */
const noFuso = (iso: string) =>
  new Date(new Date(iso).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

function mediana(valores: number[]): number | undefined {
  if (valores.length === 0) return undefined;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[meio - 1] + ordenados[meio]) / 2
    : ordenados[meio];
}

function formatarDuracao(horas: number | undefined): string {
  if (horas === undefined) return "—";
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 48) return `${horas.toFixed(1).replace(".", ",")} h`;
  return `${(horas / 24).toFixed(1).replace(".", ",")} d`;
}

function contar(itens: string[]): { rotulo: string; valor: number }[] {
  const mapa = new Map<string, number>();
  for (const item of itens) mapa.set(item, (mapa.get(item) ?? 0) + 1);
  return [...mapa.entries()]
    .map(([rotulo, valor]) => ({ rotulo, valor }))
    .sort((a, b) => b.valor - a.valor);
}

function chaveDoPeriodo(iso: string, granularidade: "dia" | "semana" | "mes") {
  const data = noFuso(iso);
  const dois = (n: number) => String(n).padStart(2, "0");

  if (granularidade === "mes") {
    return {
      chave: `${data.getFullYear()}-${dois(data.getMonth() + 1)}`,
      rotulo: `${dois(data.getMonth() + 1)}/${String(data.getFullYear()).slice(2)}`,
    };
  }

  if (granularidade === "semana") {
    const segunda = new Date(data);
    const diaDaSemana = (segunda.getDay() + 6) % 7; // segunda = 0
    segunda.setDate(segunda.getDate() - diaDaSemana);
    return {
      chave: `${segunda.getFullYear()}-${dois(segunda.getMonth() + 1)}-${dois(segunda.getDate())}`,
      rotulo: `${dois(segunda.getDate())}/${dois(segunda.getMonth() + 1)}`,
    };
  }

  return {
    chave: `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`,
    rotulo: `${dois(data.getDate())}/${dois(data.getMonth() + 1)}`,
  };
}

function montarTendencia(
  chamados: LinhaChamado[],
  granularidade: "dia" | "semana" | "mes",
): Ponto[] {
  const mapa = new Map<string, Ponto>();

  const garantir = (iso: string) => {
    const { chave, rotulo } = chaveDoPeriodo(iso, granularidade);
    if (!mapa.has(chave)) mapa.set(chave, { rotulo, recebidos: 0, resolvidos: 0 });
    return mapa.get(chave)!;
  };

  for (const chamado of chamados) {
    garantir(chamado.criado_em).recebidos += 1;
    if (chamado.resolvido_em) garantir(chamado.resolvido_em).resolvidos += 1;
  }

  return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, ponto]) => ponto);
}

type Resumo = {
  recebidos: number;
  resolvidos: number;
  primeiraResposta: number | undefined;
  resolucao: number | undefined;
  respondidosEm24h: number | undefined;
};

function resumir(chamados: LinhaChamado[]): Resumo {
  const comResposta = chamados.filter((c) => c.primeira_resposta_em);
  const resolvidos = chamados.filter((c) => c.resolvido_em);

  return {
    recebidos: chamados.length,
    resolvidos: resolvidos.length,
    primeiraResposta: mediana(
      comResposta.map((c) => horasEntre(c.criado_em, c.primeira_resposta_em!)),
    ),
    resolucao: mediana(resolvidos.map((c) => horasEntre(c.criado_em, c.resolvido_em!))),
    respondidosEm24h:
      comResposta.length === 0
        ? undefined
        : (comResposta.filter((c) => horasEntre(c.criado_em, c.primeira_resposta_em!) <= 24)
            .length /
            comResposta.length) *
          100,
  };
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default async function PaginaIndicadores({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; vinculo?: string; unidade?: string }>;
}) {
  const agente = await agenteAtual();
  if (!agente) redirect("/rh/login");

  const filtros = await searchParams;
  const periodo = PERIODOS.find((p) => p.slug === filtros.periodo) ?? PERIODOS[1];
  const supabase = await supabaseServidor();

  const colunas =
    "id, protocolo, status, vinculo, categoria, subcategoria, unidade, responsavel_id, criado_em, primeira_resposta_em, resolvido_em";

  // Puxa dois períodos: o atual e o anterior, para calcular a variação.
  let consulta = supabase
    .from("chamados")
    .select(colunas)
    .order("criado_em", { ascending: false })
    .limit(LIMITE_LEITURA);

  const inicioAtual = periodo.dias
    ? new Date(Date.now() - periodo.dias * 24 * 60 * 60_000)
    : null;
  const inicioAnterior = periodo.dias
    ? new Date(Date.now() - periodo.dias * 2 * 24 * 60 * 60_000)
    : null;

  if (inicioAnterior) consulta = consulta.gte("criado_em", inicioAnterior.toISOString());
  if (filtros.vinculo) consulta = consulta.eq("vinculo", filtros.vinculo);
  if (filtros.unidade) consulta = consulta.eq("unidade", filtros.unidade);

  const [{ data: linhas }, { data: equipe }, { data: anexos }, { data: unidades }] =
    await Promise.all([
      consulta,
      supabase.from("rh_usuarios").select("id, nome").order("nome"),
      supabase
        .from("chamado_anexos")
        .select("tamanho_bytes")
        .is("removido_em", null)
        .limit(LIMITE_LEITURA),
      supabase.from("chamados").select("unidade").not("unidade", "is", null).limit(LIMITE_LEITURA),
    ]);

  const todos = (linhas ?? []) as LinhaChamado[];
  const atuais = inicioAtual
    ? todos.filter((c) => new Date(c.criado_em) >= inicioAtual)
    : todos;
  const anteriores = inicioAtual
    ? todos.filter((c) => new Date(c.criado_em) < inicioAtual)
    : [];

  const agora = resumir(atuais);
  const antes = anteriores.length > 0 ? resumir(anteriores) : null;

  const nomePorId = new Map((equipe ?? []).map((u) => [u.id, u.nome]));
  const emAberto = atuais.filter((c) => STATUS_ABERTOS.includes(c.status as never));
  const semResposta = emAberto.filter((c) => !c.primeira_resposta_em);
  const semResponsavel = emAberto.filter((c) => !c.responsavel_id);
  const maisAntigo = [...emAberto].sort(
    (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime(),
  )[0];

  const parametros = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (filtros.periodo) p.set("periodo", filtros.periodo);
    if (filtros.vinculo) p.set("vinculo", filtros.vinculo);
    if (filtros.unidade) p.set("unidade", filtros.unidade);
    for (const [chave, valor] of Object.entries(extra)) p.set(chave, valor);
    return p.toString();
  };

  const situacao = contar(atuais.map((c) => c.status)).map((item) => ({
    rotulo: tituloStatus(item.rotulo),
    valor: item.valor,
    cor: COR_POR_STATUS[item.rotulo] ?? "#94a3b8",
    href: `/rh?status=${item.rotulo}`,
  }));

  const temas = contar(atuais.map((c) => rotuloAssunto(c.vinculo, c.categoria, c.subcategoria)))
    .slice(0, 8)
    .map((item) => ({
      ...item,
      href: `/rh?status=todos&busca=${encodeURIComponent(item.rotulo.split(" › ")[1] ?? item.rotulo)}`,
    }));

  const porVinculo = contar(atuais.map((c) => c.vinculo)).map((item, i) => ({
    rotulo: tituloVinculo(item.rotulo),
    valor: item.valor,
    cor: corDaSerie(i),
    href: `/rh?status=todos&vinculo=${item.rotulo}`,
  }));

  const porUnidade = contar(
    atuais.map((c) => (c.unidade?.trim() ? c.unidade.trim() : "Não informada")),
  ).slice(0, 8);

  const porAnalista = (equipe ?? [])
    .map((pessoa) => {
      const meus = atuais.filter((c) => c.responsavel_id === pessoa.id);
      const resolvidos = meus.filter((c) => c.resolvido_em);
      return {
        id: pessoa.id,
        nome: pessoa.nome,
        total: meus.length,
        emAberto: meus.filter((c) => STATUS_ABERTOS.includes(c.status as never)).length,
        resolvidos: resolvidos.length,
        medianaResolucao: mediana(resolvidos.map((c) => horasEntre(c.criado_em, c.resolvido_em!))),
      };
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total);

  const cargaMaxima = Math.max(...porAnalista.map((p) => p.total), 1);
  const listaUnidades = [
    ...new Set((unidades ?? []).map((u) => (u.unidade ?? "").trim()).filter(Boolean)),
  ].sort();

  const bytesGuardados = (anexos ?? []).reduce((soma, a) => soma + (a.tamanho_bytes ?? 0), 0);
  const usoArmazenamento = Math.min(100, (bytesGuardados / COTA_ARMAZENAMENTO) * 100);

  return (
    <>
      <CabecalhoRh agente={agente} />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-tea-marinho">Indicadores</h1>
            <p className="mt-1 text-sm text-slate-500">
              {periodo.dias ? `Últimos ${periodo.titulo.toLowerCase()}` : "Todo o histórico"}
              {filtros.vinculo && ` · ${tituloVinculo(filtros.vinculo)}`}
              {filtros.unidade && ` · ${filtros.unidade}`}
              {antes && " · comparado ao período anterior"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PERIODOS.map((opcao) => (
              <Link
                key={opcao.slug}
                href={`/rh/indicadores?${parametros({ periodo: opcao.slug })}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  opcao.slug === periodo.slug
                    ? "bg-tea-turquesa-700 text-white"
                    : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {opcao.titulo}
              </Link>
            ))}
          </div>
        </div>

        <form className="cartao mt-4 flex flex-wrap items-end gap-3 p-4" method="get">
          <input type="hidden" name="periodo" value={periodo.slug} />
          <div>
            <label className="rotulo" htmlFor="vinculo">
              Vínculo
            </label>
            <select id="vinculo" name="vinculo" defaultValue={filtros.vinculo ?? ""} className="campo">
              <option value="">Todos</option>
              {VINCULOS.map((v) => (
                <option key={v.slug} value={v.slug}>
                  {v.titulo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="rotulo" htmlFor="unidade">
              Unidade
            </label>
            <select id="unidade" name="unidade" defaultValue={filtros.unidade ?? ""} className="campo">
              <option value="">Todas</option>
              {listaUnidades.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="botao-primario">
            Aplicar
          </button>
          {(filtros.vinculo || filtros.unidade) && (
            <Link href={`/rh/indicadores?periodo=${periodo.slug}`} className="botao-secundario">
              Limpar
            </Link>
          )}
        </form>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi
            titulo="Chamados recebidos"
            valor={String(agora.recebidos)}
            anterior={antes?.recebidos}
            atual={agora.recebidos}
            cor="bg-tea-azul-500"
            maiorEhMelhor={null}
          />
          <Kpi
            titulo="Resolvidos"
            valor={String(agora.resolvidos)}
            anterior={antes?.resolvidos}
            atual={agora.resolvidos}
            cor="bg-tea-turquesa-500"
            maiorEhMelhor
          />
          <Kpi
            titulo="1ª resposta (mediana)"
            valor={formatarDuracao(agora.primeiraResposta)}
            anterior={antes?.primeiraResposta}
            atual={agora.primeiraResposta}
            cor="bg-tea-ambar-500"
            maiorEhMelhor={false}
          />
          <Kpi
            titulo="Resolução (mediana)"
            valor={formatarDuracao(agora.resolucao)}
            anterior={antes?.resolucao}
            atual={agora.resolucao}
            cor="bg-tea-laranja-500"
            maiorEhMelhor={false}
          />
          <Kpi
            titulo="Respondidos em 24 h"
            valor={
              agora.respondidosEm24h === undefined
                ? "—"
                : `${Math.round(agora.respondidosEm24h)}%`
            }
            anterior={antes?.respondidosEm24h}
            atual={agora.respondidosEm24h}
            cor="bg-tea-vinho-500"
            maiorEhMelhor
          />
        </div>

        {(semResposta.length > 0 || semResponsavel.length > 0 || maisAntigo) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Alerta
              titulo="Sem nenhuma resposta"
              valor={semResposta.length}
              detalhe="chamados em aberto que ninguém respondeu ainda"
              href="/rh?responsavel=&status=aberto"
              alerta={semResposta.length > 0}
            />
            <Alerta
              titulo="Sem responsável"
              valor={semResponsavel.length}
              detalhe="ninguém assumiu esses chamados"
              href="/rh?responsavel=sem"
              alerta={semResponsavel.length > 0}
            />
            {maisAntigo && (
              <Link
                href={`/rh/chamados/${maisAntigo.id}`}
                className="cartao p-4 transition hover:border-tea-turquesa-200 hover:bg-tea-turquesa-50"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Mais antigo em aberto
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-tea-marinho">
                  {maisAntigo.protocolo}
                </p>
                <p className="text-xs text-slate-500">
                  aberto em {formatarData(maisAntigo.criado_em)} ·{" "}
                  {Math.round(horasEntre(maisAntigo.criado_em, new Date().toISOString()) / 24)} dias
                  parado
                </p>
              </Link>
            )}
          </div>
        )}

        <section className="cartao mt-6 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">Recebidos x resolvidos</h2>
            <p className="text-xs text-slate-500">
              {periodo.granularidade === "dia"
                ? "por dia"
                : periodo.granularidade === "semana"
                  ? "por semana"
                  : "por mês"}
            </p>
          </div>
          <div className="mt-4">
            <Tendencia pontos={montarTendencia(atuais, periodo.granularidade)} />
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="cartao p-5">
            <h2 className="text-sm font-bold text-slate-900">Situação dos chamados</h2>
            <p className="mt-1 text-xs text-slate-500">Clique para ver a lista correspondente.</p>
            <div className="mt-4">
              <Rosca fatias={situacao} titulo="Situação dos chamados" />
            </div>
          </section>

          <section className="cartao p-5">
            <h2 className="text-sm font-bold text-slate-900">Por vínculo</h2>
            <p className="mt-1 text-xs text-slate-500">
              Mostra de onde vem a demanda: CLT, PJ ou estágio.
            </p>
            <div className="mt-4">
              <Rosca fatias={porVinculo} titulo="Chamados por vínculo" />
            </div>
          </section>

          <section className="cartao p-5">
            <h2 className="text-sm font-bold text-slate-900">Temas mais solicitados</h2>
            <p className="mt-1 text-xs text-slate-500">
              Os oito assuntos que mais ocupam o RH — clique para abrir a lista.
            </p>
            <div className="mt-4">
              <Barras itens={temas} totalParaPercentual={atuais.length} cor="#26a3d0" />
            </div>
          </section>

          <section className="cartao p-5">
            <h2 className="text-sm font-bold text-slate-900">Por unidade</h2>
            <p className="mt-1 text-xs text-slate-500">
              Unidades que mais acionam a Central no período.
            </p>
            <div className="mt-4">
              <Barras itens={porUnidade} totalParaPercentual={atuais.length} cor="#09a497" />
            </div>
          </section>
        </div>

        <section className="cartao mt-6 overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">Carga por analista</h2>
            <p className="mt-1 text-xs text-slate-500">
              Distribuição do atendimento entre a equipe no período.
            </p>
          </div>

          {porAnalista.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              Nenhum chamado atribuído. A equipe usa “Assumir chamado” na tela de atendimento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Analista</th>
                    <th className="px-5 py-3 font-semibold">Carga</th>
                    <th className="px-5 py-3 font-semibold">Em aberto</th>
                    <th className="px-5 py-3 font-semibold">Resolvidos</th>
                    <th className="px-5 py-3 font-semibold">Tempo até resolver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {porAnalista.map((pessoa) => (
                    <tr key={pessoa.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-semibold text-slate-800">{pessoa.nome}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-8 shrink-0 font-semibold text-slate-900">
                            {pessoa.total}
                          </span>
                          <span className="h-2 w-full max-w-[160px] overflow-hidden rounded-full bg-slate-100">
                            <span
                              className="block h-full rounded-full bg-tea-turquesa-500"
                              style={{ width: `${(pessoa.total / cargaMaxima) * 100}%` }}
                            />
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{pessoa.emAberto}</td>
                      <td className="px-5 py-3 text-slate-600">{pessoa.resolvidos}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {formatarDuracao(pessoa.medianaResolucao)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="cartao mt-6 p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Armazenamento de anexos</h2>
              <p className="mt-1 text-2xl font-bold text-tea-marinho">
                {formatarBytes(bytesGuardados)}
                <span className="ml-2 text-sm font-normal text-slate-500">de 1 GB</span>
              </p>
            </div>
            <p className="text-xs text-slate-500">
              {(anexos ?? []).length} arquivo{(anexos ?? []).length === 1 ? "" : "s"} guardado
              {(anexos ?? []).length === 1 ? "" : "s"} · os anexos são apagados após 30 dias
            </p>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${
                usoArmazenamento > 80 ? "bg-tea-vinho-500" : "bg-tea-turquesa-500"
              }`}
              style={{ width: `${Math.max(2, usoArmazenamento)}%` }}
            />
          </div>
        </section>

        <p className="mt-6 text-xs leading-relaxed text-slate-500">
          Os tempos usam a <strong>mediana</strong> — o valor do meio, que não é distorcido por um
          chamado esquecido por semanas. Chamados sem resposta ou ainda não resolvidos não entram
          nesses cálculos. As variações comparam com o período imediatamente anterior de mesma
          duração.
        </p>
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------

function Kpi({
  titulo,
  valor,
  atual,
  anterior,
  cor,
  maiorEhMelhor,
}: {
  titulo: string;
  valor: string;
  atual: number | undefined;
  anterior: number | undefined;
  cor: string;
  maiorEhMelhor: boolean | null;
}) {
  let variacao: { texto: string; bom: boolean | null } | null = null;

  if (atual !== undefined && anterior !== undefined && anterior > 0) {
    const diferenca = ((atual - anterior) / anterior) * 100;
    if (Math.abs(diferenca) >= 1) {
      const subiu = diferenca > 0;
      variacao = {
        texto: `${subiu ? "▲" : "▼"} ${Math.abs(Math.round(diferenca))}%`,
        bom: maiorEhMelhor === null ? null : subiu === maiorEhMelhor,
      };
    }
  }

  return (
    <div className="cartao overflow-hidden">
      <div className={`h-1.5 w-full ${cor}`} aria-hidden />
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
        <p className="mt-1 text-2xl font-bold text-tea-marinho">{valor}</p>
        {variacao ? (
          <p
            className={`mt-1 text-xs font-semibold ${
              variacao.bom === null
                ? "text-slate-500"
                : variacao.bom
                  ? "text-tea-turquesa-700"
                  : "text-tea-vinho-600"
            }`}
          >
            {variacao.texto} <span className="font-normal text-slate-400">vs. anterior</span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-400">sem comparação</p>
        )}
      </div>
    </div>
  );
}

function Alerta({
  titulo,
  valor,
  detalhe,
  href,
  alerta,
}: {
  titulo: string;
  valor: number;
  detalhe: string;
  href: string;
  alerta: boolean;
}) {
  return (
    <Link
      href={href}
      className={`cartao p-4 transition hover:border-tea-turquesa-200 hover:bg-tea-turquesa-50 ${
        alerta ? "ring-1 ring-tea-laranja-200" : ""
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p
        className={`mt-1 text-2xl font-bold ${alerta ? "text-tea-laranja-700" : "text-tea-marinho"}`}
      >
        {valor}
      </p>
      <p className="text-xs text-slate-500">{detalhe}</p>
    </Link>
  );
}
