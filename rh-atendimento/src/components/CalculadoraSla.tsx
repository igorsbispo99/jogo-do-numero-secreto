"use client";

import { useEffect, useMemo, useState } from "react";
import { EtiquetaNivel } from "@/components/Sla";
import { CATALOGO, VINCULOS, type VinculoSlug } from "@/lib/catalogo";
import { PRIORIDADES } from "@/lib/dominio";
import { formatarPrazo, tempoAtePrazo } from "@/lib/format";
import { calcularSla, escolherVariante } from "@/lib/sla/calcular";
import { dataEmBrasilia } from "@/lib/sla/calendario";
import { AGRAVANTES, NIVEIS_SLA, regraDoAssunto, type AgravanteId } from "@/lib/sla/regras";

const COR_EFEITO: Record<string, string> = {
  critica: "bg-tea-vinho-100 text-tea-vinho-800",
  alta: "bg-tea-ambar-100 text-tea-ambar-800",
  sobe: "bg-tea-turquesa-100 text-tea-turquesa-800",
  "sobe-ate-alta": "bg-tea-turquesa-100 text-tea-turquesa-800",
};

const BORDA_NIVEL: Record<string, string> = {
  critica: "border-t-tea-vinho-500",
  alta: "border-t-tea-laranja-500",
  normal: "border-t-tea-turquesa-500",
  planejada: "border-t-tea-azul-500",
};

/** "AAAA-MM-DDTHH:MM" do relógio de Brasília, para o campo de data e hora. */
function agoraEmBrasilia(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "00";
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
}

function lerAbertura(valor: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor);
  return m ? dataEmBrasilia(+m[1], +m[2], +m[3], +m[4], +m[5]) : null;
}

export function CalculadoraSla() {
  const [vinculo, setVinculo] = useState<VinculoSlug>("clt");
  const categorias = CATALOGO[vinculo];
  const [categoria, setCategoria] = useState(categorias[0].slug);
  const categoriaAtual = categorias.find((c) => c.slug === categoria) ?? categorias[0];
  const [assunto, setAssunto] = useState(categoriaAtual.subcategorias[0].slug);
  const subAtual =
    categoriaAtual.subcategorias.find((s) => s.slug === assunto) ?? categoriaAtual.subcategorias[0];

  const { regra } = regraDoAssunto(vinculo, categoriaAtual.slug, subAtual.slug);
  const [variante, setVariante] = useState<string>("");
  const [dataInformada, setDataInformada] = useState("");
  const [agravantes, setAgravantes] = useState<AgravanteId[]>([]);
  const [abertura, setAbertura] = useState("");
  const [agora, setAgora] = useState<Date | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  // A hora do navegador só existe depois de montar: evita divergência com o servidor.
  useEffect(() => {
    setAbertura(agoraEmBrasilia());
    setAgora(new Date());
    const id = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Ao trocar de assunto, volta para o detalhe padrão e limpa a data.
  useEffect(() => {
    setVariante(regra.variantes ? (escolherVariante(regra, {}, "")?.nome ?? "") : "");
    setDataInformada("");
  }, [vinculo, categoriaAtual.slug, subAtual.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const abertoEm = lerAbertura(abertura);
  const resultado = useMemo(() => {
    if (!abertoEm) return null;
    return calcularSla({
      vinculo,
      categoria: categoriaAtual.slug,
      subcategoria: subAtual.slug,
      dadosExtras: regra.data && dataInformada ? { [regra.data.campo]: dataInformada } : {},
      abertoEm,
      agravantes,
      variante: variante || null,
    });
  }, [vinculo, categoriaAtual.slug, subAtual.slug, regra, dataInformada, abertoEm?.getTime(), agravantes, variante]); // eslint-disable-line react-hooks/exhaustive-deps

  const trocarVinculo = (v: VinculoSlug) => {
    setVinculo(v);
    const primeira = CATALOGO[v][0];
    setCategoria(primeira.slug);
    setAssunto(primeira.subcategorias[0].slug);
  };

  const copiar = async () => {
    if (!resultado) return;
    const texto = [
      "SLA do chamado",
      `Assunto: ${VINCULOS.find((v) => v.slug === vinculo)?.titulo} › ${categoriaAtual.titulo} › ${subAtual.titulo}${resultado.variante ? ` · ${resultado.variante}` : ""}`,
      `Prioridade: ${NIVEIS_SLA[resultado.nivel].titulo} (no portal: ${PRIORIDADES[NIVEIS_SLA[resultado.nivel].prioridade].titulo})`,
      `1ª resposta até: ${formatarPrazo(resultado.primeiraRespostaAte)}`,
      `Resolução até: ${formatarPrazo(resultado.resolucaoAte)}`,
      ...(resultado.entrega ? [`Para dar como resolvido: ${resultado.entrega}`] : []),
      "Motivo:",
      ...resultado.motivos.filter((m) => !m.semEfeito).map((m) => `- ${m.texto}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado("Resumo copiado.");
    } catch {
      setCopiado("Não consegui copiar. Selecione o resultado e copie com Ctrl+C.");
    }
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="cartao divide-y divide-slate-100">
        <fieldset className="space-y-3 p-5">
          <legend className="float-left mb-3 w-full text-base font-bold text-slate-900">Quem abriu o chamado</legend>
          <div className="flex flex-wrap gap-2">
            {VINCULOS.map((v) => (
              <button
                key={v.slug}
                type="button"
                aria-pressed={vinculo === v.slug}
                onClick={() => trocarVinculo(v.slug)}
                className={`rounded-lg border px-4 py-2 font-semibold ${
                  vinculo === v.slug
                    ? "border-tea-turquesa-700 bg-tea-turquesa-100 text-tea-turquesa-800"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {v.titulo}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-3 p-5">
          <h2 className="text-base font-bold text-slate-900">Assunto do chamado</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="calc-categoria">
                Categoria
              </label>
              <select
                id="calc-categoria"
                className="campo"
                value={categoriaAtual.slug}
                onChange={(e) => {
                  setCategoria(e.target.value);
                  const cat = categorias.find((c) => c.slug === e.target.value);
                  if (cat) setAssunto(cat.subcategorias[0].slug);
                }}
              >
                {categorias.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="calc-assunto">
                Assunto
              </label>
              <select
                id="calc-assunto"
                className="campo"
                value={subAtual.slug}
                onChange={(e) => setAssunto(e.target.value)}
              >
                {categoriaAtual.subcategorias.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.titulo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {regra.variantes && (
            <div>
              <label className="rotulo" htmlFor="calc-variante">
                {regra.variantes.titulo}
              </label>
              <select
                id="calc-variante"
                className="campo"
                value={variante}
                onChange={(e) => setVariante(e.target.value)}
              >
                {regra.variantes.opcoes.map((o) => (
                  <option key={o.nome} value={o.nome}>
                    {o.nome} · {NIVEIS_SLA[o.nivel].titulo}
                  </option>
                ))}
              </select>
            </div>
          )}

          {regra.data && (
            <div>
              <label className="rotulo" htmlFor="calc-data">
                {regra.data.campo} (se o chamado informar)
              </label>
              <input
                id="calc-data"
                type="date"
                className="campo"
                value={dataInformada}
                onChange={(e) => setDataInformada(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">
                {regra.data.regra === "programavel"
                  ? "Faltando 30 dias ou menos, sobe para Normal. Faltando 7 dias ou menos, ou com a data já passada, sobe para Alta."
                  : "Faltando 7 dias ou menos, ou com a data já passada, sobe para Alta."}
              </p>
            </div>
          )}
        </div>

        <fieldset className="space-y-2 p-5 [&>label]:clear-both">
          <legend className="float-left mb-3 w-full text-base font-bold text-slate-900">Leia o chamado e marque o que for verdade</legend>
          <p className="text-sm text-slate-500">
            Cada item pode subir a prioridade. Nenhum item baixa. Na dúvida entre dois níveis, escolha o mais alto.
          </p>
          {AGRAVANTES.map((a) => (
            <label
              key={a.id}
              htmlFor={`calc-${a.id}`}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 has-[:checked]:border-tea-turquesa-500 has-[:checked]:bg-tea-turquesa-50"
            >
              <input
                id={`calc-${a.id}`}
                type="checkbox"
                checked={agravantes.includes(a.id)}
                onChange={(e) =>
                  setAgravantes((atual) =>
                    e.target.checked ? [...atual, a.id] : atual.filter((x) => x !== a.id),
                  )
                }
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{a.titulo}</span>
                <span className="block text-xs text-slate-500">{a.ajuda}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${COR_EFEITO[a.efeito]}`}>
                {a.rotulo}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="space-y-2 p-5">
          <label className="rotulo" htmlFor="calc-abertura">
            Data e hora de abertura (horário de Brasília)
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="calc-abertura"
              type="datetime-local"
              className="campo max-w-xs"
              value={abertura}
              onChange={(e) => setAbertura(e.target.value)}
            />
            <button type="button" className="botao-secundario" onClick={() => setAbertura(agoraEmBrasilia())}>
              Agora
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Contam só horas úteis: segunda a sexta, das 08:00 às 18:00, sem feriados.
          </p>
        </div>
      </div>

      <aside className="cartao overflow-hidden lg:sticky lg:top-4" aria-live="polite">
        {!resultado ? (
          <p className="p-6 text-sm text-slate-500">Informe a data e a hora de abertura.</p>
        ) : (
          <>
            <div className={`space-y-4 border-b border-t-[6px] border-b-slate-100 p-5 ${BORDA_NIVEL[resultado.nivel]}`}>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Prioridade</p>
                <p className="text-3xl font-extrabold text-tea-marinho">{NIVEIS_SLA[resultado.nivel].titulo}</p>
                <p className="text-sm text-slate-600">
                  No portal: <strong>{PRIORIDADES[NIVEIS_SLA[resultado.nivel].prioridade].titulo}</strong>
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">1ª resposta até</p>
                  <p className="text-lg font-bold text-slate-900">{formatarPrazo(resultado.primeiraRespostaAte)}</p>
                  {agora && (
                    <p className="text-sm font-semibold text-slate-700">
                      {tempoAtePrazo(resultado.primeiraRespostaAte, agora)}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">{resultado.regraResposta}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Resolução até</p>
                  <p className="text-lg font-bold text-slate-900">{formatarPrazo(resultado.resolucaoAte)}</p>
                  {agora && (
                    <p className="text-sm font-semibold text-slate-700">{tempoAtePrazo(resultado.resolucaoAte, agora)}</p>
                  )}
                  <p className="text-xs text-slate-500">{resultado.regraResolucao}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-5 text-sm">
              {resultado.nivel === "critica" && (
                <p className="rounded-lg border border-tea-vinho-200 bg-tea-vinho-50 px-4 py-3">
                  <strong className="text-tea-vinho-700">Escale agora.</strong> Avise o Head de RH por telefone
                  ou mensagem, mesmo fora do expediente, e registre no chamado.
                </p>
              )}
              {(resultado.alerta || resultado.entrega || resultado.dica) && (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
                  {resultado.alerta && (
                    <p>
                      <strong className="text-tea-vinho-700">Atenção:</strong> {resultado.alerta}
                    </p>
                  )}
                  {resultado.entrega && (
                    <p>
                      <strong>Para dar como resolvido:</strong> {resultado.entrega}
                    </p>
                  )}
                  {resultado.dica && <p>{resultado.dica}</p>}
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Por que esse nível</p>
                <ul className="space-y-1.5">
                  {resultado.motivos.map((m, i) => (
                    <li key={i} className={`flex items-start gap-2 ${m.semEfeito ? "text-slate-400" : "text-slate-700"}`}>
                      <EtiquetaNivel nivel={m.nivel} />
                      <span>{m.texto}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Como a resolução foi calculada</p>
                <ul className="list-disc space-y-1 pl-5 text-slate-700">
                  {resultado.motivosResolucao.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="botao-primario" onClick={copiar}>
                  Copiar resumo
                </button>
                {copiado && <span className="text-sm font-medium text-tea-turquesa-700">{copiado}</span>}
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
