import Link from "next/link";
import { FaixaMarca, MarcaTea } from "@/components/Logo";

export function Cabecalho({ compacto = false }: { compacto?: boolean }) {
  return (
    <header className="bg-white">
      <FaixaMarca />
      <div className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <MarcaTea className="h-11 w-11 shrink-0" />
            <span className="leading-tight">
              <span className="block text-sm font-bold text-tea-marinho">
                Central de Atendimento
              </span>
              <span className="block text-xs text-slate-500">Recursos Humanos · Grupo TEA</span>
            </span>
          </Link>
          {!compacto && (
            <nav className="flex items-center gap-4 text-sm font-semibold">
              <Link href="/consulta" className="text-slate-600 hover:text-tea-turquesa-700">
                Acompanhar
              </Link>
              <Link href="/abrir" className="botao-primario !px-4 !py-2 text-sm">
                Registrar solicitação
              </Link>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}

export function Rodape() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <FaixaMarca className="opacity-70" />
      <div className="mx-auto max-w-5xl px-4 py-6 text-xs leading-relaxed text-slate-500">
        <p className="font-semibold text-tea-marinho">TEA Clínica e Desenvolvimento LTDA</p>
        <p>CNPJ 34.183.295/0005-24 · Unidade ADM</p>
        <p className="mt-1 font-medium text-slate-400">Conectar · Acolher · Desenvolver</p>
        <p className="mt-2">
          Os dados informados aqui são usados apenas para tratar sua solicitação de RH, conforme a
          LGPD. Atestados e documentos ficam em armazenamento restrito à equipe de RH. Conte com a
          gente 💙
        </p>
        <p className="mt-3">
          <Link href="/rh" className="font-semibold text-slate-500 hover:text-tea-turquesa-700">
            Acesso da equipe de RH
          </Link>
        </p>
      </div>
    </footer>
  );
}
