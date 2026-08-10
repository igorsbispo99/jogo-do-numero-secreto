"use client";

import { useActionState, useRef } from "react";
import { atualizarChamado, type EstadoSimples } from "@/actions/rh";
import { PRIORIDADES, STATUS } from "@/lib/dominio";

const INICIAL: EstadoSimples = { estado: "inicial" };

export function ControlesChamado({
  chamadoId,
  status,
  prioridade,
  responsavelId,
  equipe,
}: {
  chamadoId: string;
  status: string;
  prioridade: string;
  responsavelId: string | null;
  equipe: { id: string; nome: string }[];
}) {
  const [estado, acao] = useActionState(atualizarChamado, INICIAL);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={acao} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="chamadoId" value={chamadoId} />

      <div>
        <label className="rotulo" htmlFor="status">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="campo"
          onChange={() => formRef.current?.requestSubmit()}
        >
          {Object.entries(STATUS).map(([slug, info]) => (
            <option key={slug} value={slug}>
              {info.titulo}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="rotulo" htmlFor="prioridade">
          Prioridade
        </label>
        <select
          id="prioridade"
          name="prioridade"
          defaultValue={prioridade}
          className="campo"
          onChange={() => formRef.current?.requestSubmit()}
        >
          {Object.entries(PRIORIDADES).map(([slug, info]) => (
            <option key={slug} value={slug}>
              {info.titulo}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="rotulo" htmlFor="responsavelId">
          Responsável
        </label>
        <select
          id="responsavelId"
          name="responsavelId"
          defaultValue={responsavelId ?? "ninguem"}
          className="campo"
          onChange={() => formRef.current?.requestSubmit()}
        >
          <option value="ninguem">Sem responsável</option>
          {equipe.map((pessoa) => (
            <option key={pessoa.id} value={pessoa.id}>
              {pessoa.nome}
            </option>
          ))}
        </select>
      </div>

      {estado.estado === "erro" && (
        <p role="alert" className="text-sm font-medium text-red-700 sm:col-span-3">
          {estado.mensagem}
        </p>
      )}
    </form>
  );
}
