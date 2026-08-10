import Link from "next/link";

export function Cabecalho({ compacto = false }: { compacto?: boolean }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-marca-700 text-sm font-bold text-white">
            TEA
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold text-slate-900">Central de Atendimento</span>
            <span className="block text-xs text-slate-500">Recursos Humanos · Grupo TEA</span>
          </span>
        </Link>
        {!compacto && (
          <nav className="flex items-center gap-4 text-sm font-semibold">
            <Link href="/consulta" className="text-slate-600 hover:text-marca-700">
              Acompanhar chamado
            </Link>
            <Link href="/abrir" className="botao-primario !px-4 !py-2 text-sm">
              Abrir chamado
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}

export function Rodape() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-6 text-xs leading-relaxed text-slate-500">
        <p className="font-semibold text-slate-600">TEA Clínica e Desenvolvimento LTDA</p>
        <p>CNPJ 34.183.295/0005-24 · Unidade ADM</p>
        <p className="mt-2">
          Os dados informados aqui são usados apenas para tratar sua solicitação de RH, conforme a
          LGPD. Atestados e documentos ficam em armazenamento restrito à equipe de RH.
        </p>
        <p className="mt-3">
          <Link href="/rh" className="font-semibold text-slate-500 hover:text-marca-700">
            Acesso da equipe de RH
          </Link>
        </p>
      </div>
    </footer>
  );
}
