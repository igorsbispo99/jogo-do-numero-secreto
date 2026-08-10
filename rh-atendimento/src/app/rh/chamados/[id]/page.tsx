import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { assumirChamado } from "@/actions/rh";
import { CabecalhoRh } from "@/components/CabecalhoRh";
import { ControlesChamado } from "@/components/ControlesChamado";
import { EtiquetaPrioridade, EtiquetaStatus, EtiquetaVinculo } from "@/components/Etiquetas";
import { RespostaRh } from "@/components/RespostaRh";
import { formatarBytes, formatarDataHora, mascararCpf } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { agenteAtual, supabaseServidor } from "@/lib/supabase/server";
import type { Anexo, Chamado, Evento, Mensagem } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaChamado({ params }: { params: Promise<{ id: string }> }) {
  const agente = await agenteAtual();
  if (!agente) redirect("/rh/login");

  const { id } = await params;
  const supabase = await supabaseServidor();

  const { data: chamado } = await supabase.from("chamados").select("*").eq("id", id).maybeSingle();
  if (!chamado) notFound();

  const dados = chamado as Chamado;

  const [{ data: mensagens }, { data: anexos }, { data: eventos }, { data: equipe }] =
    await Promise.all([
      supabase
        .from("chamado_mensagens")
        .select("*")
        .eq("chamado_id", id)
        .order("criado_em", { ascending: true }),
      supabase
        .from("chamado_anexos")
        .select("*")
        .eq("chamado_id", id)
        .order("criado_em", { ascending: true }),
      supabase
        .from("chamado_eventos")
        .select("*")
        .eq("chamado_id", id)
        .order("criado_em", { ascending: false }),
      supabase.from("rh_usuarios").select("id, nome").eq("ativo", true).order("nome"),
    ]);

  // Links temporários dos anexos: o bucket é privado, nada fica exposto.
  const admin = supabaseAdmin();
  const anexosComLink = await Promise.all(
    ((anexos ?? []) as Anexo[]).map(async (anexo) => {
      const { data } = await admin.storage.from("anexos").createSignedUrl(anexo.caminho, 60 * 30);
      return { ...anexo, url: data?.signedUrl ?? null };
    }),
  );

  const responsavel = (equipe ?? []).find((p) => p.id === dados.responsavel_id);

  return (
    <>
      <CabecalhoRh agente={agente} />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/rh" className="text-sm font-semibold text-slate-500 hover:text-marca-700">
          ← Voltar para a fila
        </Link>

        <div className="cartao mt-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold text-slate-500">{dados.protocolo}</span>
                <EtiquetaVinculo vinculo={dados.vinculo} />
                <EtiquetaStatus status={dados.status} />
                <EtiquetaPrioridade prioridade={dados.prioridade} />
              </div>
              <h1 className="mt-2 text-xl font-bold text-slate-900">{dados.assunto}</h1>
              <p className="mt-1 text-sm text-slate-500">
                Aberto em {formatarDataHora(dados.criado_em)}
                {dados.primeira_resposta_em &&
                  ` · 1ª resposta em ${formatarDataHora(dados.primeira_resposta_em)}`}
              </p>
            </div>

            {dados.responsavel_id !== agente.id && (
              <form action={assumirChamado}>
                <input type="hidden" name="chamadoId" value={dados.id} />
                <button type="submit" className="botao-secundario">
                  Assumir chamado
                </button>
              </form>
            )}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <ControlesChamado
              chamadoId={dados.id}
              status={dados.status}
              prioridade={dados.prioridade}
              responsavelId={dados.responsavel_id}
              equipe={equipe ?? []}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="cartao divide-y divide-slate-100">
              {((mensagens ?? []) as Mensagem[]).map((mensagem) => {
                const anexosDaMensagem = anexosComLink.filter(
                  (a) => a.mensagem_id === mensagem.id,
                );
                return (
                  <article
                    key={mensagem.id}
                    className={`p-5 ${mensagem.interna ? "bg-amber-50" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">
                        {mensagem.autor_nome}
                        <span className="ml-2 font-normal text-slate-500">
                          {mensagem.autor_tipo === "rh"
                            ? "RH"
                            : mensagem.autor_tipo === "colaborador"
                              ? "Colaborador"
                              : "Sistema"}
                        </span>
                        {mensagem.interna && (
                          <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
                            Nota interna
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{formatarDataHora(mensagem.criado_em)}</p>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {mensagem.corpo}
                    </p>

                    {anexosDaMensagem.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {anexosDaMensagem.map((anexo) => (
                          <li key={anexo.id} className="text-sm">
                            <a
                              href={anexo.url ?? "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-marca-700 hover:underline"
                            >
                              📎 {anexo.nome_arquivo}
                            </a>
                            <span className="ml-2 text-xs text-slate-400">
                              {formatarBytes(anexo.tamanho_bytes)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>

            <RespostaRh chamadoId={dados.id} />
          </div>

          <aside className="space-y-6">
            <div className="cartao p-5">
              <h2 className="text-sm font-bold text-slate-900">Solicitante</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Linha rotulo="Nome" valor={dados.solicitante_nome} />
                <Linha rotulo="E-mail" valor={dados.solicitante_email} />
                <Linha rotulo="CPF" valor={mascararCpf(dados.solicitante_cpf)} />
                {dados.solicitante_telefone && (
                  <Linha rotulo="Telefone" valor={dados.solicitante_telefone} />
                )}
                {dados.unidade && <Linha rotulo="Unidade" valor={dados.unidade} />}
                <Linha
                  rotulo="Responsável"
                  valor={responsavel?.nome ?? "Sem responsável"}
                />
              </dl>
            </div>

            {Object.keys(dados.dados_extras ?? {}).length > 0 && (
              <div className="cartao p-5">
                <h2 className="text-sm font-bold text-slate-900">Dados da solicitação</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  {Object.entries(dados.dados_extras).map(([rotulo, valor]) => (
                    <Linha key={rotulo} rotulo={rotulo} valor={String(valor)} />
                  ))}
                </dl>
              </div>
            )}

            {anexosComLink.length > 0 && (
              <div className="cartao p-5">
                <h2 className="text-sm font-bold text-slate-900">
                  Anexos ({anexosComLink.length})
                </h2>
                <ul className="mt-3 space-y-2">
                  {anexosComLink.map((anexo) => (
                    <li key={anexo.id} className="text-sm">
                      <a
                        href={anexo.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-marca-700 hover:underline"
                      >
                        {anexo.nome_arquivo}
                      </a>
                      <span className="ml-2 text-xs text-slate-400">
                        {formatarBytes(anexo.tamanho_bytes)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="cartao p-5">
              <h2 className="text-sm font-bold text-slate-900">Histórico</h2>
              <ul className="mt-3 space-y-3">
                {((eventos ?? []) as Evento[]).map((evento) => (
                  <li key={evento.id} className="text-xs text-slate-600">
                    <span className="block font-medium text-slate-800">{evento.descricao}</span>
                    <span className="text-slate-400">
                      {evento.autor_nome} · {formatarDataHora(evento.criado_em)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{rotulo}</dt>
      <dd className="break-words text-slate-800">{valor}</dd>
    </div>
  );
}
