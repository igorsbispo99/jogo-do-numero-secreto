import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CabecalhoRh } from "@/components/CabecalhoRh";
import { EtiquetaPrioridade, EtiquetaStatus, EtiquetaVinculo } from "@/components/Etiquetas";
import { EtiquetaAConfirmar, EtiquetaNivel, PrazosNaFila } from "@/components/Sla";
import { inicioDoDia, somarDias } from "@/lib/sla/calendario";
import { NIVEIS_SLA, ORDEM_NIVEIS } from "@/lib/sla/regras";
import { VINCULOS } from "@/lib/catalogo";
import { STATUS, STATUS_ABERTOS } from "@/lib/dominio";
import { formatarDataHora, tempoRelativo } from "@/lib/format";
import { agenteAtual, supabaseServidor } from "@/lib/supabase/server";
import type { Chamado } from "@/lib/tipos";

export const metadata: Metadata = { title: "Painel do RH · Grupo TEA" };
export const dynamic = "force-dynamic";

const POR_PAGINA = 25;

type Filtros = {
  status?: string;
  vinculo?: string;
  responsavel?: string;
  busca?: string;
  pagina?: string;
  base?: string;
  criticidade?: string;
  prazo?: string;
  classificacao?: string;
  ordem?: string;
};

const COLUNAS_BASE =
  "id, protocolo, solicitante_nome, vinculo, assunto, status, prioridade, responsavel_id, criado_em, atualizado_em, de_teste";
const COLUNAS_SLA =
  ", sla_nivel, sla_primeira_resposta_ate, sla_resolucao_ate, sla_pausado_desde, sla_proximo_prazo, sla_confirmado_em, primeira_resposta_em, resolvido_em";

export default async function PainelRh({
  searchParams,
}: {
  searchParams: Promise<Filtros>;
}) {
  const agente = await agenteAtual();
  if (!agente) redirect("/rh/login");

  const filtros = await searchParams;
  const pagina = Math.max(1, Number(filtros.pagina ?? "1") || 1);
  const supabase = await supabaseServidor();

  const agora = new Date();
  const fimDeHoje = somarDias(inicioDoDia(agora), 1);
  const agoraIso = agora.toISOString();
  const fimDeHojeIso = fimDeHoje.toISOString();

  const montarConsulta = (comSla: boolean) => {
    let consulta = supabase
      .from("chamados")
      .select(COLUNAS_BASE + (comSla ? COLUNAS_SLA : ""), { count: "exact" });

    // Por padrão a fila mostra só a operação real; os testes ficam guardados.
    if (filtros.base === "testes") consulta = consulta.eq("de_teste", true);
    else if (filtros.base !== "todos") consulta = consulta.eq("de_teste", false);

    if (filtros.status === "abertos" || !filtros.status) {
      consulta = consulta.in("status", STATUS_ABERTOS);
    } else if (filtros.status !== "todos") {
      consulta = consulta.eq("status", filtros.status);
    }

    if (filtros.vinculo) consulta = consulta.eq("vinculo", filtros.vinculo);
    if (filtros.responsavel === "meus") consulta = consulta.eq("responsavel_id", agente.id);
    if (filtros.responsavel === "sem") consulta = consulta.is("responsavel_id", null);

    if (filtros.busca) {
      const termo = filtros.busca.trim().replace(/[%,()]/g, "");
      if (termo) {
        consulta = consulta.or(
          `protocolo.ilike.%${termo}%,solicitante_nome.ilike.%${termo}%,solicitante_email.ilike.%${termo}%,solicitante_cpf.ilike.%${termo}%,assunto.ilike.%${termo}%`,
        );
      }
    }

    if (comSla) {
      if (filtros.criticidade === "sem") consulta = consulta.is("sla_nivel", null);
      else if (ORDEM_NIVEIS.includes(filtros.criticidade as never)) {
        consulta = consulta.eq("sla_nivel", filtros.criticidade!);
      }

      // "Próximo prazo" é a 1ª resposta enquanto ela não sai, depois a resolução.
      if (filtros.prazo === "vencidos") consulta = consulta.lt("sla_proximo_prazo", agoraIso);
      if (filtros.prazo === "resposta-vencida") {
        consulta = consulta.is("primeira_resposta_em", null).lt("sla_primeira_resposta_ate", agoraIso);
      }
      if (filtros.prazo === "hoje") {
        consulta = consulta.gte("sla_proximo_prazo", agoraIso).lt("sla_proximo_prazo", fimDeHojeIso);
      }
      if (filtros.prazo === "no-prazo") consulta = consulta.gte("sla_proximo_prazo", fimDeHojeIso);
      if (filtros.prazo === "pausados") consulta = consulta.not("sla_pausado_desde", "is", null);

      if (filtros.classificacao === "pendente") {
        consulta = consulta.is("sla_confirmado_em", null).not("sla_nivel", "is", null);
      }
      if (filtros.classificacao === "confirmada") consulta = consulta.not("sla_confirmado_em", "is", null);
    }

    if (comSla && filtros.ordem === "prazo") {
      consulta = consulta.order("sla_proximo_prazo", { ascending: true, nullsFirst: false });
    }
    return consulta
      .order("atualizado_em", { ascending: false })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  };

  const [primeira, { data: equipe }, indicadores, prazosDeHoje] = await Promise.all([
    montarConsulta(true),
    supabase.from("rh_usuarios").select("id, nome").eq("ativo", true).order("nome"),
    carregarIndicadores(agente.id),
    carregarPrazosDeHoje(agoraIso, fimDeHojeIso),
  ]);

  // Banco ainda sem a migração de SLA: a fila continua funcionando como antes.
  const semSla = Boolean(primeira.error);
  if (semSla) console.error("[fila] consulta com SLA falhou:", primeira.error?.message);
  const { data: chamados, count } = semSla ? await montarConsulta(false) : primeira;

  const nomePorId = new Map((equipe ?? []).map((u) => [u.id, u.nome]));
  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <CabecalhoRh agente={agente} />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador
            titulo="Na fila"
            valor={indicadores.abertos}
            barra="bg-tea-azul-500"
            texto="text-tea-azul-700"
          />
          <Indicador
            titulo="Em andamento"
            valor={indicadores.emAndamento}
            barra="bg-tea-ambar-500"
            texto="text-tea-ambar-700"
          />
          <Indicador
            titulo="Aguardando colaborador"
            valor={indicadores.aguardando}
            barra="bg-tea-laranja-500"
            texto="text-tea-laranja-700"
          />
          <Indicador
            titulo="Meus chamados"
            valor={indicadores.meus}
            barra="bg-tea-turquesa-500"
            texto="text-tea-turquesa-700"
          />
        </div>

        {prazosDeHoje && <PainelPrazosDeHoje dados={prazosDeHoje} />}
        {semSla && (
          <p className="mt-6 rounded-lg bg-tea-ambar-50 px-4 py-3 text-sm text-tea-ambar-800 ring-1 ring-tea-ambar-200">
            Os prazos de SLA ainda não aparecem porque o banco não recebeu a atualização. Rode o
            arquivo supabase/schema.sql no SQL Editor do Supabase.
          </p>
        )}

        <form className="cartao mt-6 flex flex-wrap items-end gap-3 p-4" method="get">
          <div className="min-w-[220px] flex-1">
            <label className="rotulo" htmlFor="busca">
              Buscar
            </label>
            <input
              id="busca"
              name="busca"
              defaultValue={filtros.busca ?? ""}
              placeholder="Protocolo, nome, e-mail ou CPF"
              className="campo"
            />
          </div>

          <div>
            <label className="rotulo" htmlFor="status">
              Status
            </label>
            <select id="status" name="status" defaultValue={filtros.status ?? "abertos"} className="campo">
              <option value="abertos">Em aberto</option>
              <option value="todos">Todos</option>
              {Object.entries(STATUS).map(([slug, info]) => (
                <option key={slug} value={slug}>
                  {info.titulo}
                </option>
              ))}
            </select>
          </div>

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
            <label className="rotulo" htmlFor="base">
              Base
            </label>
            <select id="base" name="base" defaultValue={filtros.base ?? ""} className="campo">
              <option value="">Chamados reais</option>
              <option value="testes">Somente testes</option>
              <option value="todos">Reais + testes</option>
            </select>
          </div>

          <div>
            <label className="rotulo" htmlFor="responsavel">
              Responsável
            </label>
            <select
              id="responsavel"
              name="responsavel"
              defaultValue={filtros.responsavel ?? ""}
              className="campo"
            >
              <option value="">Todos</option>
              <option value="meus">Meus chamados</option>
              <option value="sem">Sem responsável</option>
            </select>
          </div>

          <div>
            <label className="rotulo" htmlFor="criticidade">
              Criticidade
            </label>
            <select
              id="criticidade"
              name="criticidade"
              defaultValue={filtros.criticidade ?? ""}
              className="campo"
            >
              <option value="">Todas</option>
              {[...ORDEM_NIVEIS].reverse().map((nivel) => (
                <option key={nivel} value={nivel}>
                  {NIVEIS_SLA[nivel].titulo}
                </option>
              ))}
              <option value="sem">Sem classificação</option>
            </select>
          </div>

          <div>
            <label className="rotulo" htmlFor="prazo">
              Prazo
            </label>
            <select id="prazo" name="prazo" defaultValue={filtros.prazo ?? ""} className="campo">
              <option value="">Todos</option>
              <option value="vencidos">Vencidos</option>
              <option value="resposta-vencida">1ª resposta vencida</option>
              <option value="hoje">Vencem hoje</option>
              <option value="no-prazo">No prazo</option>
              <option value="pausados">Pausados</option>
            </select>
          </div>

          <div>
            <label className="rotulo" htmlFor="classificacao">
              SLA
            </label>
            <select
              id="classificacao"
              name="classificacao"
              defaultValue={filtros.classificacao ?? ""}
              className="campo"
            >
              <option value="">Todos</option>
              <option value="pendente">A confirmar</option>
              <option value="confirmada">Confirmado</option>
            </select>
          </div>

          <div>
            <label className="rotulo" htmlFor="ordem">
              Ordenar por
            </label>
            <select id="ordem" name="ordem" defaultValue={filtros.ordem ?? ""} className="campo">
              <option value="">Última atualização</option>
              <option value="prazo">Prazo mais próximo</option>
            </select>
          </div>

          <button type="submit" className="botao-primario">
            Filtrar
          </button>
          <Link href="/rh" className="botao-secundario">
            Limpar
          </Link>
        </form>

        <p className="mt-6 text-sm text-slate-500">
          {total} chamado{total === 1 ? "" : "s"} encontrado{total === 1 ? "" : "s"}
        </p>

        <div className="cartao mt-3 overflow-hidden">
          {(chamados ?? []).length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Nenhum chamado com esses filtros.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(chamados as unknown as Chamado[]).map((chamado) => (
                <li key={chamado.id}>
                  <Link
                    href={`/rh/chamados/${chamado.id}`}
                    className="flex flex-col gap-2 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500">
                          {chamado.protocolo}
                        </span>
                        <EtiquetaVinculo vinculo={chamado.vinculo} />
                        {chamado.sla_nivel ? (
                          <EtiquetaNivel nivel={chamado.sla_nivel} />
                        ) : (
                          <EtiquetaPrioridade prioridade={chamado.prioridade} />
                        )}
                        {chamado.sla_nivel && !chamado.sla_confirmado_em && <EtiquetaAConfirmar />}
                        {chamado.de_teste && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">
                            Teste
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate font-semibold text-slate-900">{chamado.assunto}</p>
                      <p className="mt-0.5 truncate text-sm text-slate-500">
                        {chamado.solicitante_nome} · aberto em {formatarDataHora(chamado.criado_em)}
                      </p>
                    </div>

                    {!semSla && (
                      <div className="shrink-0 sm:w-72">
                        <PrazosNaFila chamado={chamado} agora={agora} fimDeHoje={fimDeHoje} />
                      </div>
                    )}

                    <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                      <EtiquetaStatus status={chamado.status} />
                      <span className="text-xs text-slate-500">
                        {chamado.responsavel_id
                          ? (nomePorId.get(chamado.responsavel_id) ?? "Atribuído")
                          : "Sem responsável"}{" "}
                        · {tempoRelativo(chamado.atualizado_em)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {totalPaginas > 1 && (
          <nav className="mt-6 flex items-center justify-center gap-2 text-sm">
            {Array.from({ length: totalPaginas }, (_, i) => i + 1)
              .filter((n) => Math.abs(n - pagina) < 3 || n === 1 || n === totalPaginas)
              .map((n) => {
                const params = new URLSearchParams(
                  Object.entries(filtros).filter(([, v]) => Boolean(v)) as [string, string][],
                );
                params.set("pagina", String(n));
                return (
                  <Link
                    key={n}
                    href={`/rh?${params.toString()}`}
                    className={`rounded-lg px-3 py-1.5 font-semibold ${
                      n === pagina
                        ? "bg-tea-turquesa-700 text-white"
                        : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {n}
                  </Link>
                );
              })}
          </nav>
        )}
      </main>
    </>
  );
}

async function carregarIndicadores(agenteId: string) {
  const supabase = await supabaseServidor();
  const contagem = () =>
    supabase.from("chamados").select("id", { count: "exact", head: true }).eq("de_teste", false);

  const [abertos, emAndamento, aguardando, meus] = await Promise.all([
    contagem().eq("status", "aberto"),
    contagem().eq("status", "em_andamento"),
    contagem().eq("status", "aguardando_colaborador"),
    contagem().eq("responsavel_id", agenteId).in("status", STATUS_ABERTOS),
  ]);

  return {
    abertos: abertos.count ?? 0,
    emAndamento: emAndamento.count ?? 0,
    aguardando: aguardando.count ?? 0,
    meus: meus.count ?? 0,
  };
}

function Indicador({
  titulo,
  valor,
  barra,
  texto,
}: {
  titulo: string;
  valor: number;
  barra: string;
  texto: string;
}) {
  return (
    <div className="cartao overflow-hidden">
      <div className={`h-1.5 w-full ${barra}`} aria-hidden />
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
        <p className={`mt-1 text-2xl font-bold ${texto}`}>{valor}</p>
      </div>
    </div>
  );
}

type PrazosDeHoje = {
  respostaVencida: number;
  vencemHoje: number;
  resolucaoVencida: number;
  pausados: number;
  aConfirmar: number;
};

/** Contagens do quadro "Prazos de hoje". Null se o banco ainda não tem as colunas de SLA. */
async function carregarPrazosDeHoje(agoraIso: string, fimDeHojeIso: string): Promise<PrazosDeHoje | null> {
  const supabase = await supabaseServidor();
  const abertos = () =>
    supabase
      .from("chamados")
      .select("id", { count: "exact", head: true })
      .eq("de_teste", false)
      .in("status", STATUS_ABERTOS);

  const respostas = await Promise.all([
    abertos().is("primeira_resposta_em", null).lt("sla_primeira_resposta_ate", agoraIso),
    abertos().gte("sla_proximo_prazo", agoraIso).lt("sla_proximo_prazo", fimDeHojeIso),
    abertos().not("primeira_resposta_em", "is", null).lt("sla_proximo_prazo", agoraIso),
    abertos().not("sla_pausado_desde", "is", null),
    abertos().is("sla_confirmado_em", null).not("sla_nivel", "is", null),
  ]);
  if (respostas.some((r) => r.error)) return null;

  const [respostaVencida, vencemHoje, resolucaoVencida, pausados, aConfirmar] = respostas.map(
    (r) => r.count ?? 0,
  );
  return { respostaVencida, vencemHoje, resolucaoVencida, pausados, aConfirmar };
}

function PainelPrazosDeHoje({ dados }: { dados: PrazosDeHoje }) {
  const blocos = [
    {
      titulo: "1ª resposta vencida",
      valor: dados.respostaVencida,
      href: "/rh?prazo=resposta-vencida&ordem=prazo",
      alerta: "vermelho" as const,
    },
    { titulo: "Vencem hoje", valor: dados.vencemHoje, href: "/rh?prazo=hoje&ordem=prazo", alerta: "ambar" as const },
    {
      titulo: "Resolução vencida",
      valor: dados.resolucaoVencida,
      href: "/rh?prazo=vencidos&ordem=prazo",
      alerta: "vermelho" as const,
    },
    { titulo: "SLA a confirmar", valor: dados.aConfirmar, href: "/rh?classificacao=pendente&ordem=prazo", alerta: "ambar" as const },
    { titulo: "Prazo pausado", valor: dados.pausados, href: "/rh?prazo=pausados", alerta: null },
  ];
  const estilo = (alerta: "vermelho" | "ambar" | null, valor: number) =>
    valor > 0 && alerta === "vermelho"
      ? "border-tea-vinho-200 bg-tea-vinho-50 text-tea-vinho-700"
      : valor > 0 && alerta === "ambar"
        ? "border-tea-ambar-200 bg-tea-ambar-50 text-tea-ambar-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <section className="cartao mt-6 p-4" aria-labelledby="prazos-de-hoje">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="prazos-de-hoje" className="text-sm font-bold text-tea-marinho">
          Prazos de hoje
        </h2>
        <Link href="/rh/sla" className="text-xs font-semibold text-tea-turquesa-700 hover:underline">
          Como os prazos são calculados
        </Link>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {blocos.map((b) => (
          <Link
            key={b.titulo}
            href={b.href}
            className={`rounded-lg border px-4 py-3 transition hover:shadow-sm ${estilo(b.alerta, b.valor)}`}
          >
            <span className="block text-xs font-semibold">{b.titulo}</span>
            <span className="mt-1 block text-2xl font-bold">{b.valor}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
