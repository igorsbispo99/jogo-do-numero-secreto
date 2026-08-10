import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CabecalhoRh } from "@/components/CabecalhoRh";
import { EtiquetaPrioridade, EtiquetaStatus, EtiquetaVinculo } from "@/components/Etiquetas";
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
};

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

  let consulta = supabase
    .from("chamados")
    .select(
      "id, protocolo, solicitante_nome, vinculo, assunto, status, prioridade, responsavel_id, criado_em, atualizado_em",
      { count: "exact" },
    );

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

  const [{ data: chamados, count }, { data: equipe }, indicadores] = await Promise.all([
    consulta
      .order("atualizado_em", { ascending: false })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1),
    supabase.from("rh_usuarios").select("id, nome").eq("ativo", true).order("nome"),
    carregarIndicadores(agente.id),
  ]);

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
              {(chamados as Chamado[]).map((chamado) => (
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
                        <EtiquetaPrioridade prioridade={chamado.prioridade} />
                      </div>
                      <p className="mt-1 truncate font-semibold text-slate-900">{chamado.assunto}</p>
                      <p className="mt-0.5 truncate text-sm text-slate-500">
                        {chamado.solicitante_nome} · aberto em {formatarDataHora(chamado.criado_em)}
                      </p>
                    </div>

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
  const contagem = () => supabase.from("chamados").select("id", { count: "exact", head: true });

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
