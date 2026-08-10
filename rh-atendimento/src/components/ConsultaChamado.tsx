"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  consultarChamado,
  responderComoColaborador,
  type ChamadoPublico,
  type EstadoConsulta,
} from "@/actions/publico";
import { EtiquetaStatus, EtiquetaVinculo } from "@/components/Etiquetas";
import { formatarBytes, formatarDataHora, mascararCpf, tempoRelativo } from "@/lib/format";
import { MAX_ANEXOS } from "@/lib/dominio";

const INICIAL: EstadoConsulta = { estado: "inicial" };

type Visao = { dados: ChamadoPublico; protocolo: string; cpf: string };

export function ConsultaChamado({ protocoloInicial = "" }: { protocoloInicial?: string }) {
  const [estadoConsulta, acaoConsulta] = useActionState(consultarChamado, INICIAL);
  const [estadoResposta, acaoResposta] = useActionState(responderComoColaborador, INICIAL);
  const [visao, setVisao] = useState<Visao | null>(null);
  const [cpf, setCpf] = useState("");

  useEffect(() => {
    if (estadoConsulta.estado === "ok") {
      setVisao({
        dados: estadoConsulta.dados,
        protocolo: estadoConsulta.protocolo,
        cpf: estadoConsulta.cpf,
      });
    }
  }, [estadoConsulta]);

  useEffect(() => {
    if (estadoResposta.estado === "ok") {
      setVisao({
        dados: estadoResposta.dados,
        protocolo: estadoResposta.protocolo,
        cpf: estadoResposta.cpf,
      });
    }
  }, [estadoResposta]);

  if (!visao) {
    return (
      <form action={acaoConsulta} className="cartao mx-auto max-w-md p-6">
        <div className="space-y-4">
          <div>
            <label className="rotulo" htmlFor="protocolo">
              Número do protocolo
            </label>
            <input
              id="protocolo"
              name="protocolo"
              required
              defaultValue={protocoloInicial}
              placeholder="TEA-2026-000123"
              className="campo font-mono uppercase"
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="cpf">
              Seu CPF
            </label>
            <input
              id="cpf"
              name="cpf"
              required
              inputMode="numeric"
              placeholder="000.000.000-00"
              className="campo"
              value={cpf}
              onChange={(e) => setCpf(mascararCpf(e.target.value))}
            />
          </div>

          {estadoConsulta.estado === "erro" && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-600/20"
            >
              {estadoConsulta.mensagem}
            </p>
          )}

          <Enviar rotulo="Consultar" carregando="Consultando..." />

          <p className="text-center text-xs text-slate-500">
            Perdeu o protocolo? Ele está no e-mail de confirmação que enviamos na abertura.
          </p>
        </div>
      </form>
    );
  }

  const { chamado, mensagens, anexos } = visao.dados;

  return (
    <div className="space-y-6">
      <div className="cartao p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-sm font-bold text-slate-500">{chamado.protocolo}</p>
            <h2 className="mt-1 text-xl font-bold text-tea-marinho">{chamado.assunto}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Aberto em {formatarDataHora(chamado.criado_em)} · última atualização{" "}
              {tempoRelativo(chamado.atualizado_em)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <EtiquetaVinculo vinculo={chamado.vinculo} />
            <EtiquetaStatus status={chamado.status} />
          </div>
        </div>

        {Object.keys(chamado.dados_extras ?? {}).length > 0 && (
          <dl className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
            {Object.entries(chamado.dados_extras).map(([rotulo, valor]) => (
              <div key={rotulo}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {rotulo}
                </dt>
                <dd className="text-sm text-slate-800">{valor}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="cartao divide-y divide-slate-100">
        {mensagens.map((mensagem) => (
          <article
            key={mensagem.id}
            className={`p-5 ${
              mensagem.autor_tipo === "rh"
                ? "border-l-4 border-tea-turquesa-500 bg-tea-turquesa-50"
                : ""
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-900">
                {mensagem.autor_tipo === "rh" ? `${mensagem.autor_nome} · RH` : mensagem.autor_nome}
              </p>
              <p className="text-xs text-slate-500">{formatarDataHora(mensagem.criado_em)}</p>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {mensagem.corpo}
            </p>
          </article>
        ))}
      </div>

      {anexos.length > 0 && (
        <div className="cartao p-5">
          <h3 className="text-sm font-bold text-slate-900">Anexos</h3>
          <ul className="mt-3 space-y-2">
            {anexos.map((anexo) => (
              <li key={anexo.id} className="text-sm">
                {anexo.url ? (
                  <a
                    href={anexo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-tea-turquesa-700 hover:underline"
                  >
                    {anexo.nome_arquivo}
                  </a>
                ) : (
                  <span className="text-slate-600">{anexo.nome_arquivo}</span>
                )}
                <span className="ml-2 text-xs text-slate-400">
                  {formatarBytes(anexo.tamanho_bytes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {chamado.status === "cancelado" ? (
        <p className="cartao p-5 text-sm text-slate-600">
          Este chamado foi cancelado e não aceita novas mensagens. Abra um novo chamado se ainda
          precisar de ajuda.
        </p>
      ) : (
        <form action={acaoResposta} className="cartao p-5">
          <input type="hidden" name="protocolo" value={visao.protocolo} />
          <input type="hidden" name="cpf" value={visao.cpf} />

          <label className="rotulo" htmlFor="mensagem">
            Responder ao RH
          </label>
          <textarea
            id="mensagem"
            name="mensagem"
            rows={4}
            required
            className="campo"
            placeholder="Escreva sua mensagem..."
          />

          <div className="mt-3">
            <label className="rotulo" htmlFor="anexos-resposta">
              Anexar arquivos (opcional)
            </label>
            <input
              id="anexos-resposta"
              name="anexos"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-tea-turquesa-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-tea-turquesa-800"
            />
            <p className="mt-1 text-xs text-slate-500">Até {MAX_ANEXOS} arquivos, 8 MB cada.</p>
          </div>

          {estadoResposta.estado === "erro" && (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-600/20"
            >
              {estadoResposta.mensagem}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <Enviar rotulo="Enviar resposta" carregando="Enviando..." />
          </div>
        </form>
      )}

      <div className="text-center">
        <button
          type="button"
          onClick={() => setVisao(null)}
          className="text-sm font-semibold text-slate-500 hover:text-tea-turquesa-700"
        >
          Consultar outro protocolo
        </button>
      </div>
    </div>
  );
}

function Enviar({ rotulo, carregando }: { rotulo: string; carregando: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="botao-primario w-full sm:w-auto">
      {pending ? carregando : rotulo}
    </button>
  );
}
