import Link from "next/link";
import { Cabecalho, Rodape } from "@/components/Cabecalho";
import { CATALOGO, VINCULOS } from "@/lib/catalogo";

export default function PaginaInicial() {
  return (
    <>
      <Cabecalho />

      <main className="mx-auto max-w-5xl px-4 py-12">
        <section className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-marca-700">
            Bem-vindo ao Grupo TEA
          </p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
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
          <h2 className="text-lg font-bold text-slate-900">Como funciona</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              {
                titulo: "1. Escolha o assunto",
                texto:
                  "Diga se você é PJ, CLT ou estagiário e selecione o que precisa. O formulário se ajusta ao seu caso.",
              },
              {
                titulo: "2. Receba o protocolo",
                texto:
                  "Você recebe um número por e-mail. É com ele e seu CPF que você acompanha tudo.",
              },
              {
                titulo: "3. Converse com o RH",
                texto:
                  "As respostas ficam registradas no chamado. Nada se perde em conversa de WhatsApp.",
              },
            ].map((passo) => (
              <li key={passo.titulo} className="cartao p-5">
                <p className="font-semibold text-marca-800">{passo.titulo}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{passo.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14">
          <h2 className="text-lg font-bold text-slate-900">O que dá para resolver por aqui</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {VINCULOS.map((vinculo) => (
              <div key={vinculo.slug} className="cartao p-5">
                <p className="text-sm font-bold text-slate-900">{vinculo.titulo}</p>
                <p className="mt-1 text-xs text-slate-500">{vinculo.descricao}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                  {CATALOGO[vinculo.slug].map((categoria) => (
                    <li key={categoria.slug} className="flex gap-2">
                      <span aria-hidden className="text-marca-600">
                        •
                      </span>
                      {categoria.titulo}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-xl bg-marca-50 p-6 ring-1 ring-marca-200">
          <h2 className="text-base font-bold text-marca-900">Urgência médica ou risco?</h2>
          <p className="mt-2 text-sm leading-relaxed text-marca-900/80">
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
