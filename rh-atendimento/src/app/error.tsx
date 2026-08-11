"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Rede de proteção: qualquer falha inesperada cai aqui em vez de mostrar a
 * tela branca de erro do navegador. O "digest" é o código que a Vercel usa
 * para achar a falha nos logs - por isso ele aparece para o usuário copiar.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[erro]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="cartao w-full p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-tea-laranja-100 text-2xl">
          ⚠️
        </div>
        <h1 className="mt-4 text-xl font-bold text-tea-marinho">Algo não saiu como esperado</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Sua solicitação pode não ter sido registrada. Tente novamente — se estava enviando
          anexos, confira se cada arquivo tem no máximo 8 MB.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="botao-primario w-full sm:w-auto">
            Tentar de novo
          </button>
          <Link href="/" className="botao-secundario w-full sm:w-auto">
            Voltar ao início
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-slate-400">
            Código para o suporte: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
    </main>
  );
}
