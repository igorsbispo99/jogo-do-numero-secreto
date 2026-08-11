import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CabecalhoRh } from "@/components/CabecalhoRh";
import { rotuloAssunto, tituloVinculo, type VinculoSlug } from "@/lib/catalogo";
import { STATUS_ABERTOS, tituloStatus } from "@/lib/dominio";
import { formatarBytes } from "@/lib/format";
import { agenteAtual, supabaseServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Indicadores · RH Grupo TEA" };
export const dynamic = "force-dynamic";

/** Teto de arquivos do plano gratuito do Supabase. */
const COTA_ARMAZENAMENTO = 1024 * 1024 * 1024;
const LIMITE_LEITURA = 10000;

const PERIODOS = [
  { slug: "30", titulo: "Últimos 30 dias", dias: 30 },
  { slug: "90", titulo: "Últimos 90 dias", dias: 90 },
  { slug: "365", titulo: "Últimos 12 meses", dias: 365 },
  { slug: "tudo", titulo: "Desde o início", dias: 0 },
];

type LinhaChamado = {
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

const horasEntre = (de: string, ate: string) =>
  (new Date(ate).getTime() - new Date(de).getTime()) / 3_600_000;

function resumoDeHoras(valores: number[]) {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  const meio = Math.floor(ordenados.length / 2);
  const mediana =
    ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
  return { media, mediana, quantidade: valores.length };
}

function formatarDuracao(horas: number | undefined): string {
  if (horas === undefined) return "—";
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 48) return `${horas.toFixed(1).replace(".", ",")} h`;
  return `${(horas / 24).toFixed(1).replace(".", ",")} dias`;
}

function contar<T extends string>(itens: T[]): { chave: T; total: number }[] {
  const mapa = new Map<T, number>();
  for (const item of itens) mapa.set(item, (mapa.get(item) ?? 0) + 1);
  return [...mapa.entries()]
    .map(([chave, total]) => ({ chave, total }))
    .sort((a, b) => b.total - a.total);
}

export default async function PaginaIndicadores({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const agente = await agenteAtual();
  if (!agente) redirect("/rh/login");

  const { periodo: periodoBruto } = await searchParams;
  const periodo = PERIODOS.find((p) => p.slug === periodoBruto) ?? PERIODOS[1];
  const supabase = await supabaseServidor();

  let consulta = supabase
    .from("chamados")
    .select(
      "status, vinculo, categoria, subcategoria, unidade, responsavel_id, criado_em, primeira_resposta_em, resolvido_em",
    )
    .order("criado_em", { ascending: false })
    .limit(LIMITE_LEITURA);

  if (periodo.dias > 0) {
    const desde = new Date(Date.now() - periodo.dias * 24 * 60 * 60_000).toISOString();
    consulta = consulta.gte("criado_em", desde);
  }

  const [{ data: linhas }, { data: equipe }, { data: anexos }] = await Promise.all([
    consulta,
    supabase.from("rh_usuarios").select("id, nome").order("nome"),
    supabase
      .from("chamado_anexos")
      .select("tamanho_bytes")
      .is("removido_em", null)
      .limit(LIMITE_LEITURA),
  ]);

  const chamados = (linhas ?? []) as LinhaChamado[];
  const nomePorId = new Map((equipe ?? []).map((u) => [u.id, u.nome]));

  const emAberto = chamados.filter((c) => STATUS_ABERTOS.includes(c.status as never)).length;
  const resolvidos = chamados.filter((c) => c.status === "resolvido").length;

  const primeiraResposta = resumoDeHoras(
    chamados
      .filter((c) => c.primeira_resposta_em)
      .map((c) => horasEntre(c.criado_em, c.primeira_resposta_em!)),
  );
  const resolucao = resumoDeHoras(
    chamados.filter((c) => c.resolvido_em).map((c) => horasEntre(c.criado_em, c.resolvido_em!)),
  );

  const semResposta = chamados.filter(
    (c) => !c.primeira_resposta_em && STATUS_ABERTOS.includes(c.status as never),
  ).length;

  const temas = contar(
    chamados.map((c) => rotuloAssunto(c.vinculo, c.categoria, c.subcategoria)),
  ).slice(0, 10);

  const porVinculo = contar(chamados.map((c) => tituloVinculo(c.vinculo)));
  const porStatus = contar(chamados.map((c) => tituloStatus(c.status)));
  const porUnidade = contar(
    chamados.map((c) => (c.unidade?.trim() ? c.unidade.trim() : "Não informada")),
  ).slice(0, 10);

  const porAnalista = (equipe ?? [])
    .map((pessoa) => {
      const meus = chamados.filter((c) => c.responsavel_id === pessoa.id);
      const resolvidosDoAnalista = meus.filter((c) => c.resolvido_em);
      const tempos = resumoDeHoras(
        resolvidosDoAnalista.map((c) => horasEntre(c.criado_em, c.resolvido_em!)),
      );
      return {
        nome: pessoa.nome,
        total: meus.length,
        emAberto: meus.filter((c) => STATUS_ABERTOS.includes(c.status as never)).length,
        resolvidos: resolvidosDoAnalista.length,
        medianaResolucao: tempos?.mediana,
      };
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total);

  const semResponsavel = chamados.filter((c) => !c.responsavel_id).length;

  const porMes = (() => {
    const mapa = new Map<string, number>();
    for (const chamado of chamados) {
      const data = new Date(chamado.criado_em);
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
      mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
    }
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([chave, total]) => {
        const [ano, mes] = chave.split("-");
        return { chave: `${mes}/${ano.slice(2)}`, total };
      });
  })();

  const bytesGuardados = (anexos ?? []).reduce((soma, a) => soma + (a.tamanho_bytes ?? 0), 0);
  const usoArmazenamento = Math.min(100, (bytesGuardados / COTA_ARMAZENAMENTO) * 100);

  return (
    <>
      <CabecalhoRh agente={agente} />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-tea-marinho">Indicadores</h1>
            <p className="mt-1 text-sm text-slate-500">
              {periodo.titulo} · {chamados.length} chamado
              {chamados.length === 1 ? "" : "s"} no período
            </p>
          </div>

          <nav className="flex flex-wrap gap-2">
            {PERIODOS.map((opcao) => (
              <Link
                key={opcao.slug}
                href={`/rh/indicadores?periodo=${opcao.slug}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  opcao.slug === periodo.slug
                    ? "bg-tea-turquesa-700 text-white"
                    : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {opcao.titulo}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Numero titulo="Chamados no período" valor={String(chamados.length)} cor="bg-tea-azul-500" />
          <Numero titulo="Em aberto agora" valor={String(emAberto)} cor="bg-tea-ambar-500" />
          <Numero
            titulo="Tempo até a 1ª resposta"
            valor={formatarDuracao(primeiraResposta?.mediana)}
            rodape={`média ${formatarDuracao(primeiraResposta?.media)} · ${primeiraResposta?.quantidade ?? 0} chamados`}
            cor="bg-tea-turquesa-500"
          />
          <Numero
            titulo="Tempo até resolver"
            valor={formatarDuracao(resolucao?.mediana)}
            rodape={`média ${formatarDuracao(resolucao?.media)} · ${resolvidos} resolvidos`}
            cor="bg-tea-laranja-500"
          />
        </div>

        {(semResposta > 0 || semResponsavel > 0) && (
          <div className="mt-4 rounded-xl border border-tea-ambar-200 bg-tea-ambar-50 p-4 text-sm text-slate-700">
            <strong className="text-tea-ambar-800">Atenção:</strong> {semResposta} chamado
            {semResposta === 1 ? "" : "s"} em aberto ainda sem nenhuma resposta · {semResponsavel}{" "}
            sem responsável definido.
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Bloco titulo="Temas mais solicitados">
            <Barras itens={temas} total={chamados.length} cor="bg-tea-azul-500" />
          </Bloco>

          <Bloco titulo="Chamados por unidade">
            <Barras itens={porUnidade} total={chamados.length} cor="bg-tea-turquesa-500" />
          </Bloco>

          <Bloco titulo="Chamados por vínculo">
            <Barras itens={porVinculo} total={chamados.length} cor="bg-tea-ambar-500" />
          </Bloco>

          <Bloco titulo="Situação atual">
            <Barras itens={porStatus} total={chamados.length} cor="bg-tea-laranja-500" />
          </Bloco>

          <Bloco titulo="Volume por mês">
            <Barras
              itens={porMes}
              total={Math.max(...porMes.map((m) => m.total), 1)}
              cor="bg-tea-vinho-500"
            />
          </Bloco>

          <Bloco titulo="Armazenamento de anexos">
            <p className="text-2xl font-bold text-tea-marinho">{formatarBytes(bytesGuardados)}</p>
            <p className="mt-1 text-sm text-slate-500">
              de 1 GB disponíveis · {(anexos ?? []).length} arquivo
              {(anexos ?? []).length === 1 ? "" : "s"} guardado
              {(anexos ?? []).length === 1 ? "" : "s"}
            </p>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${
                  usoArmazenamento > 80 ? "bg-tea-vinho-500" : "bg-tea-turquesa-500"
                }`}
                style={{ width: `${Math.max(2, usoArmazenamento)}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Só contam os arquivos ainda guardados: os anexos são apagados automaticamente após
              30 dias, então este número tende a se estabilizar.
            </p>
          </Bloco>
        </div>

        <div className="cartao mt-6 overflow-hidden">
          <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-900">
            Chamados por analista
          </h2>
          {porAnalista.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              Nenhum chamado atribuído no período. Use “Assumir chamado” na tela de atendimento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Analista</th>
                    <th className="px-5 py-3 font-semibold">Total</th>
                    <th className="px-5 py-3 font-semibold">Em aberto</th>
                    <th className="px-5 py-3 font-semibold">Resolvidos</th>
                    <th className="px-5 py-3 font-semibold">Tempo até resolver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {porAnalista.map((pessoa) => (
                    <tr key={pessoa.nome}>
                      <td className="px-5 py-3 font-semibold text-slate-800">{pessoa.nome}</td>
                      <td className="px-5 py-3 text-slate-600">{pessoa.total}</td>
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
        </div>

        <p className="mt-6 text-xs leading-relaxed text-slate-500">
          Os tempos são apresentados pela mediana — o valor do meio, que não é distorcido por um
          chamado que ficou semanas parado. A média aparece embaixo, para comparação. Chamados sem
          resposta ou sem resolução não entram nesses cálculos.
        </p>
      </main>
    </>
  );
}

function Numero({
  titulo,
  valor,
  rodape,
  cor,
}: {
  titulo: string;
  valor: string;
  rodape?: string;
  cor: string;
}) {
  return (
    <div className="cartao overflow-hidden">
      <div className={`h-1.5 w-full ${cor}`} aria-hidden />
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
        <p className="mt-1 text-2xl font-bold text-tea-marinho">{valor}</p>
        {rodape && <p className="mt-1 text-xs text-slate-500">{rodape}</p>}
      </div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="cartao p-5">
      <h2 className="text-sm font-bold text-slate-900">{titulo}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Barras({
  itens,
  total,
  cor,
}: {
  itens: { chave: string; total: number }[];
  total: number;
  cor: string;
}) {
  if (itens.length === 0) {
    return <p className="text-sm text-slate-500">Sem dados no período.</p>;
  }

  const maior = Math.max(...itens.map((i) => i.total), 1);

  return (
    <ul className="space-y-3">
      {itens.map((item) => (
        <li key={item.chave}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-700">{item.chave}</span>
            <span className="shrink-0 font-semibold text-slate-900">
              {item.total}
              {total > 0 && (
                <span className="ml-1 text-xs font-normal text-slate-400">
                  {Math.round((item.total / total) * 100)}%
                </span>
              )}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${cor}`}
              style={{ width: `${Math.max(2, (item.total / maior) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
