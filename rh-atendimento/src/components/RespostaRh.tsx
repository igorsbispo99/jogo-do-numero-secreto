"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { responderChamado, type EstadoSimples } from "@/actions/rh";
import { STATUS } from "@/lib/dominio";

const INICIAL: EstadoSimples = { estado: "inicial" };

export function RespostaRh({ chamadoId }: { chamadoId: string }) {
  const [estado, acao] = useActionState(responderChamado, INICIAL);
  const [interna, setInterna] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.estado === "ok") formRef.current?.reset();
  }, [estado]);

  return (
    <form
      ref={formRef}
      action={acao}
      className={`cartao p-5 ${interna ? "bg-tea-ambar-50 ring-1 ring-tea-ambar-200" : ""}`}
    >
      <input type="hidden" name="chamadoId" value={chamadoId} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="rotulo mb-0" htmlFor="mensagem">
          {interna ? "Nota interna (o colaborador não vê)" : "Responder ao colaborador"}
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <input
            type="checkbox"
            name="interna"
            checked={interna}
            onChange={(e) => setInterna(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Nota interna
        </label>
      </div>

      <textarea
        id="mensagem"
        name="mensagem"
        rows={5}
        required
        className="campo mt-2"
        placeholder={
          interna
            ? "Registro para a equipe: encaminhamentos, combinados, contexto..."
            : "Escreva a resposta que o colaborador vai receber por e-mail."
        }
      />

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <label className="rotulo" htmlFor="novoStatus">
            Status após enviar
          </label>
          <select
            id="novoStatus"
            name="novoStatus"
            defaultValue=""
            className="campo min-w-[220px]"
          >
            <option value="">
              {interna ? "Manter o status atual" : "Aguardando colaborador (padrão)"}
            </option>
            {Object.entries(STATUS).map(([slug, info]) => (
              <option key={slug} value={slug}>
                {info.titulo}
              </option>
            ))}
          </select>
        </div>

        <Botao interna={interna} />
      </div>

      {estado.estado === "erro" && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-600/20"
        >
          {estado.mensagem}
        </p>
      )}
      {estado.estado === "ok" && estado.mensagem && (
        <p className="mt-3 text-sm font-medium text-tea-turquesa-700">{estado.mensagem}</p>
      )}
    </form>
  );
}

function Botao({ interna }: { interna: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="botao-primario">
      {pending ? "Enviando..." : interna ? "Salvar nota" : "Enviar resposta"}
    </button>
  );
}
