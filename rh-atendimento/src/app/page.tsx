import Link from "next/link";
import { Cabecalho, Rodape } from "@/components/Cabecalho";
import { LogoTea } from "@/components/Logo";
import { CATALOGO, VINCULOS, type VinculoSlug } from "@/lib/catalogo";

/* Cada vínculo ganha uma cor da paleta da marca. */
const VISUAL_VINCULO: Record<VinculoSlug, { borda: string; fundo: string; texto: string }> = {
  pj: { borda: "border-tea-azul-200", fundo: "bg-tea-azul-50", texto: "text-tea-azul-800" },
  clt: {
    borda: "border-tea-turquesa-200",
    fundo: "bg-tea-turquesa-50",
    texto: "text-tea-turquesa-800",
  },
  estagio: {
    borda: "border-tea-ambar-200",
    fundo: "bg-tea-ambar-50",
    texto: "text-tea-ambar-800",
  },
};

const PASSOS = [
  {
    titulo: "1. Escolha o assunto",
    texto:
      "Diga se você é PJ, CLT ou estagiário e selecione o que precisa. O formulário se ajusta ao seu caso.",
    barra: "bg-tea-azul-500",
    numero: "text-tea-azul-700",
  },
  {
    titulo: "2. Receba o protocolo",
    texto: "Você recebe um número por e-mail. É com ele e seu CPF que você acompanha tudo.",
    barra: "bg-tea-turquesa-500",
    numero: "text-tea-turquesa-700",
  },
  {
    titulo: "3. Converse com o RH",
    texto: "As respostas ficam registradas no chamado. Nada se perde em conversa de WhatsApp.",
    barra: "bg-tea-ambar-500",
    numero: "text-tea-ambar-700",
  },
];

export default function PaginaInicial() {
  return (
    <>
      <Cabecalho />

      <main className="mx-auto max-w-5xl px-4 py-12">
        <section className="text-center">
          <LogoTea className="mx-auto mb-6 h-36 w-auto" />
          <p className="text-sm font-semibold uppercase tracking-widest text-tea-turquesa-700">
            Central de Atendimento do RH
          </p>
          <h1 className="mt-3 text-3xl font-bold text-tea-marinho sm:text-4xl">
            Um único lugar para falar com o RH
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Contratos, pagamentos, benefícios, férias, afastamentos, atestados e ponto. Registre sua
            solicitação aqui e acompanhe pelo número do protocolo — sem depender de WhatsApp, e-mail
            ou de passar na sala do RH.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/abrir" className="botao-primario w-full sm:w-auto">
              Abrir um chamado
            </Link>
            <Link href="/consulta" className="botao-secundario w-full sm:w-auto">
              Acompanhar um chamado
            </Link>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-lg font-bold text-tea-marinho">Como funciona</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {PASSOS.map((passo) => (
              <li key={passo.titulo} className="cartao overflow-hidden">
                <div className={`h-1.5 w-full ${passo.barra}`} aria-hidden />
                <div className="p-5">
                  <p className={`font-bold ${passo.numero}`}>{passo.titulo}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{passo.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14">
          <h2 className="text-lg font-bold text-tea-marinho">O que dá para resolver por aqui</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {VINCULOS.map((vinculo) => {
              const visual = VISUAL_VINCULO[vinculo.slug];
              return (
                <div
                  key={vinculo.slug}
                  className={`rounded-xl border p-5 ${visual.borda} ${visual.fundo}`}
                >
                  <p className={`text-sm font-bold ${visual.texto}`}>{vinculo.titulo}</p>
                  <p className="mt-1 text-xs text-slate-500">{vinculo.descricao}</p>
                  <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                    {CATALOGO[vinculo.slug].map((categoria) => (
                      <li key={categoria.slug} className="flex gap-2">
                        <span aria-hidden className={visual.texto}>
                          •
                        </span>
                        {categoria.titulo}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-14 rounded-xl border border-tea-laranja-200 bg-tea-laranja-50 p-6">
          <h2 className="text-base font-bold text-tea-laranja-800">Urgência médica ou risco?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            A central é para assuntos administrativos de RH. Situações de emergência, acidente de
            trabalho ou risco à segurança devem ser comunicadas imediatamente ao seu gestor e à
            equipe de RH pelos canais internos, além do registro aqui.
          </p>
        </section>
      </main>

      <Rodape />
    </>
  );
}
