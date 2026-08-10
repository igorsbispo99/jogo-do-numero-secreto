"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { entrar, type EstadoSimples } from "@/actions/rh";

const INICIAL: EstadoSimples = { estado: "inicial" };

export function FormularioLogin() {
  const [estado, acao] = useActionState(entrar, INICIAL);

  return (
    <form action={acao} className="space-y-4">
      <div>
        <label className="rotulo" htmlFor="email">
          E-mail corporativo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="campo"
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="senha">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          autoComplete="current-password"
          className="campo"
        />
      </div>

      {estado.estado === "erro" && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-600/20"
        >
          {estado.mensagem}
        </p>
      )}

      <Botao />
    </form>
  );
}

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="botao-primario w-full">
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}
