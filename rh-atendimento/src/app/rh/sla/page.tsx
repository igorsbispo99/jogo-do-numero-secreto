import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CabecalhoRh } from "@/components/CabecalhoRh";
import { CalculadoraSla } from "@/components/CalculadoraSla";
import { EtiquetaNivel } from "@/components/Sla";
import { CATALOGO, VINCULOS } from "@/lib/catalogo";
import { PRIORIDADES } from "@/lib/dominio";
import { EXPEDIENTE, proximosFeriados } from "@/lib/sla/calendario";
import { AGRAVANTES, NIVEIS_SLA, ORDEM_NIVEIS, TETO_RESOLUCAO, regraDoAssunto } from "@/lib/sla/regras";
import { agenteAtual } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Calculadora de SLA · RH Grupo TEA" };
export const dynamic = "force-dynamic";

const dias = (n: number) => (n === 1 ? "1 dia útil" : `${n} dias úteis`);
const hora = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export default async function PaginaSla() {
  const agente = await agenteAtual();
  if (!agente) redirect("/rh/login");

  const feriados = proximosFeriados(new Date(), 8);

  return (
    <>
      <CabecalhoRh agente={agente} />

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8">
        <div>
          <h1 className="text-xl font-bold text-tea-marinho">Calculadora de SLA</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Use para simular um caso ou consultar as regras. Nos chamados, a prioridade e os prazos já chegam
            calculados como prévia, e a triagem confirma ou revisa.
          </p>
          <nav className="mt-4 flex flex-wrap gap-4 text-sm font-semibold" aria-label="Seções">
            <a href="#calculadora" className="text-tea-turquesa-700 hover:underline">Calculadora</a>
            <a href="#assuntos" className="text-tea-turquesa-700 hover:underline">Prazos por assunto</a>
            <a href="#regras" className="text-tea-turquesa-700 hover:underline">Regras</a>
          </nav>
        </div>

        <section id="calculadora" aria-label="Calculadora">
          <CalculadoraSla />
        </section>

        <section id="assuntos" className="space-y-3">
          <h2 className="text-lg font-bold text-tea-marinho">Prazos por assunto</h2>
          <p className="text-sm text-slate-500">
            Prioridade base e prazo de resolução de cada assunto do portal. A prioridade sobe com os
            agravantes e com datas próximas; o prazo de resolução encurta quando a prioridade sobe.
          </p>
          <div className="cartao overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Assunto</th>
                  <th className="px-4 py-3">Prioridade base</th>
                  <th className="px-4 py-3">Resolução</th>
                  <th className="px-4 py-3">Por quê</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {VINCULOS.map((v) => (
                  <Grupo key={v.slug} vinculo={v.slug} titulo={v.titulo} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="regras" className="space-y-6">
          <h2 className="text-lg font-bold text-tea-marinho">Regras</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[...ORDEM_NIVEIS].reverse().map((n) => (
              <div key={n} className="cartao space-y-2 p-4">
                <EtiquetaNivel nivel={n} />
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">1ª resposta</p>
                <p className="font-semibold text-slate-900">{NIVEIS_SLA[n].regraResposta}</p>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Resolução</p>
                <p className="font-semibold text-slate-900">
                  {n === "planejada"
                    ? "Data combinada na triagem"
                    : n === "critica"
                      ? "Até 1 dia útil: resolver ou conter o risco"
                      : `Prazo do assunto; no máximo ${dias(TETO_RESOLUCAO[n]!)} quando a prioridade sobe`}
                </p>
                <p className="text-sm text-slate-500">{NIVEIS_SLA[n].descricao}</p>
                <p className="text-sm text-slate-600">
                  No portal: <strong>{PRIORIDADES[NIVEIS_SLA[n].prioridade].titulo}</strong>
                </p>
              </div>
            ))}
          </div>

          <div className="cartao space-y-3 p-5 text-sm leading-relaxed text-slate-700">
            <h3 className="font-bold text-slate-900">Agravantes</h3>
            <ul className="space-y-1.5">
              {AGRAVANTES.map((a) => (
                <li key={a.id}>
                  <strong>{a.titulo}</strong> ({a.rotulo}): {a.ajuda}
                </li>
              ))}
            </ul>
            <p>Vale sempre o nível mais alto. Nenhum agravante baixa a prioridade.</p>
          </div>

          <div className="cartao space-y-3 p-5 text-sm leading-relaxed text-slate-700">
            <h3 className="font-bold text-slate-900">Como os prazos são contados</h3>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Contam só horas úteis: segunda a sexta, das {hora(EXPEDIENTE.inicio)} às {hora(EXPEDIENTE.fim)}, sem
                feriados nacionais, de São Paulo e Carnaval.
              </li>
              <li>
                <strong>Crítica:</strong> 2 horas úteis. Escale na hora, mesmo fora do expediente: o Head de RH e a
                triagem recebem um aviso por e-mail assim que o chamado chega.
              </li>
              <li>
                <strong>Alta:</strong> fim do expediente do dia. Com menos de 2 horas úteis no dia, 12h do dia útil
                seguinte.
              </li>
              <li>
                <strong>Normal:</strong> 1 dia útil a partir da abertura. <strong>Planejada:</strong> triagem em até
                2 dias úteis.
              </li>
              <li>
                Os prazos contam desde a abertura do chamado, não desde a confirmação do SLA.
              </li>
              <li>
                <strong>Prazo pausado:</strong> enquanto o chamado está “Aguardando colaborador”, o relógio da
                resolução para, e o prazo é estendido quando o chamado volta a andar.
              </li>
              <li>
                Quando o pedido precisa estar pronto antes de uma data informada no chamado, a resolução vence no
                último dia útil antes dela.
              </li>
            </ul>
            {feriados.length > 0 && (
              <p className="text-slate-500">
                Próximos feriados considerados:{" "}
                {feriados.map((f) => `${f.data.slice(8, 10)}/${f.data.slice(5, 7)} ${f.nome}`).join(" · ")}
              </p>
            )}
            <p className="text-slate-500">
              As regras ficam em <code>src/lib/sla/regras.ts</code>. Para mudar um prazo, peça ao responsável pelo
              portal.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}

function Grupo({ vinculo, titulo }: { vinculo: keyof typeof CATALOGO; titulo: string }) {
  const linhas = CATALOGO[vinculo].flatMap((c) =>
    c.subcategorias.map((s) => ({ c, s, ...regraDoAssunto(vinculo, c.slug, s.slug) })),
  );
  return (
    <>
      <tr className="bg-tea-turquesa-50">
        <td colSpan={4} className="px-4 py-2 font-bold text-tea-turquesa-800">
          {titulo}
        </td>
      </tr>
      {linhas.map(({ c, s, regra }) => (
        <tr key={`${vinculo}-${c.slug}-${s.slug}`} className="align-top">
          <td className="px-4 py-3">
            <span className="block font-semibold text-slate-900">{s.titulo}</span>
            <span className="text-xs text-slate-500">{c.titulo}</span>
          </td>
          <td className="px-4 py-3">
            {regra.variantes ? (
              <ul className="space-y-1">
                {regra.variantes.opcoes.map((o) => (
                  <li key={o.nome} className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                    <EtiquetaNivel nivel={o.nivel} /> {o.nome}
                  </li>
                ))}
              </ul>
            ) : (
              <EtiquetaNivel nivel={regra.base} />
            )}
          </td>
          <td className="px-4 py-3 text-slate-700">
            {regra.variantes ? (
              <ul className="space-y-1 text-xs">
                {regra.variantes.opcoes.map((o) => (
                  <li key={o.nome}>
                    {o.nome}: {dias(o.dias)}
                  </li>
                ))}
              </ul>
            ) : (
              dias(regra.dias)
            )}
            {regra.data && <span className="block text-xs text-slate-500">ou antes da data informada</span>}
          </td>
          <td className="max-w-md px-4 py-3 text-slate-600">{regra.por}</td>
        </tr>
      ))}
    </>
  );
}
