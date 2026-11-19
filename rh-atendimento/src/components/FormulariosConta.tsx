"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  adicionarDestinatario,
  alterarSenha,
  definirNovaSenha,
  pedirRecuperacao,
} from "@/actions/conta";
import type { EstadoSimples } from "@/actions/rh";

const INICIAL: EstadoSimples = { estado: "inicial" };

function Retorno({ estado }: { estado: EstadoSimples }) {
  if (estado.estado === "erro") {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-600/20">
        {estado.mensagem}
      </p>
    );
  }
  if (estado.estado === "ok" && estado.mensagem) {
    return (
      <p role="status" className="rounded-lg bg-tea-turquesa-50 px-4 py-3 text-sm font-medium text-tea-turquesa-800">
        {estado.mensagem}
      </p>
    );
  }
  return null;
}

function Enviar({ rotulo, enviando, largo = false }: { rotulo: string; enviando: string; largo?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`botao-primario ${largo ? "w-full" : ""}`}>
      {pending ? enviando : rotulo}
    </button>
  );
}

/** Dicas da nova senha, conferidas enquanto a pessoa digita. Nada sai do navegador. */
function RegrasSenha({ senha, confirmacao }: { senha: string; confirmacao: string }) {
  const regras = [
    { ok: senha.length >= 10, texto: "Pelo menos 10 caracteres" },
    { ok: /[A-Za-zÀ-ÿ]/.test(senha) && /\d/.test(senha), texto: "Letras e números" },
    { ok: senha.length > 0 && senha === confirmacao, texto: "Confirmação igual à nova senha" },
  ];
  return (
    <ul className="space-y-1 text-xs" aria-label="Requisitos da nova senha">
      {regras.map((r) => (
        <li key={r.texto} className={r.ok ? "text-tea-turquesa-700" : "text-slate-500"}>
          {r.ok ? "✓" : "○"} {r.texto}
        </li>
      ))}
    </ul>
  );
}

function CamposNovaSenha() {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  return (
    <>
      <div>
        <label className="rotulo" htmlFor="novaSenha">
          Nova senha
        </label>
        <input
          id="novaSenha"
          name="novaSenha"
          type="password"
          required
          minLength={10}
          maxLength={72}
          autoComplete="new-password"
          className="campo"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </div>
      <div>
        <label className="rotulo" htmlFor="confirmacao">
          Confirme a nova senha
        </label>
        <input
          id="confirmacao"
          name="confirmacao"
          type="password"
          required
          autoComplete="new-password"
          className="campo"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
        />
      </div>
      <RegrasSenha senha={senha} confirmacao={confirmacao} />
    </>
  );
}

export function FormularioAlterarSenha() {
  const [estado, acao] = useActionState(alterarSenha, INICIAL);
  const [rodada, setRodada] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.estado === "ok") {
      formRef.current?.reset();
      setRodada((n) => n + 1);
    }
  }, [estado]);

  return (
    <form ref={formRef} action={acao} className="space-y-4">
      <div>
        <label className="rotulo" htmlFor="senhaAtual">
          Senha atual
        </label>
        <input
          id="senhaAtual"
          name="senhaAtual"
          type="password"
          required
          autoComplete="current-password"
          className="campo"
        />
      </div>
      <CamposNovaSenha key={rodada} />
      <Retorno estado={estado} />
      <Enviar rotulo="Alterar senha" enviando="Alterando..." />
    </form>
  );
}

export function FormularioRecuperar() {
  const [estado, acao] = useActionState(pedirRecuperacao, INICIAL);
  return (
    <form action={acao} className="space-y-4">
      <div>
        <label className="rotulo" htmlFor="email">
          E-mail corporativo cadastrado no painel
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="campo" />
      </div>
      <Retorno estado={estado} />
      <Enviar rotulo="Enviar link" enviando="Enviando..." largo />
    </form>
  );
}

export function FormularioNovaSenha() {
  const [estado, acao] = useActionState(definirNovaSenha, INICIAL);
  return (
    <form action={acao} className="space-y-4">
      <CamposNovaSenha />
      <Retorno estado={estado} />
      <Enviar rotulo="Salvar nova senha" enviando="Salvando..." largo />
    </form>
  );
}

export function FormularioDestinatario() {
  const [estado, acao] = useActionState(adicionarDestinatario, INICIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.estado === "ok") formRef.current?.reset();
  }, [estado]);

  return (
    <form ref={formRef} action={acao} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="rotulo" htmlFor="dest-email">
            E-mail
          </label>
          <input id="dest-email" name="email" type="email" required className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="dest-papel">
            Recebe
          </label>
          <select id="dest-papel" name="papel" className="campo" defaultValue="gestao">
            <option value="gestao">Resumo da gestão</option>
            <option value="triagem">Avisos de triagem</option>
          </select>
        </div>
        <Enviar rotulo="Adicionar" enviando="Salvando..." />
      </div>
      <Retorno estado={estado} />
    </form>
  );
}
