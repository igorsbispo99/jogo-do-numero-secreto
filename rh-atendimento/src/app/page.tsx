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
    texto:
      "Você recebe um número por e-mail. É com ele e seu CPF que você acompanha cada etapa.",
    barra: "bg-tea-turquesa-500",
    numero: "text-tea-turquesa-700",
  },
  {
    titulo: "3. Converse com o RH",
    texto:
      "As respostas ficam registradas no seu protocolo e você recebe as atualizações por e-mail.",
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
            Bem-vindo à nossa Central de Atendimento de RH 💙
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Criamos este espaço para tornar o seu dia a dia mais simples e garantir que você tenha um
            canal fácil, organizado e seguro para falar com a gente.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">
            Por aqui, colaboradores e prestadores de serviço registram dúvidas e solicitações sobre
            contratos, pagamentos, benefícios, férias, afastamentos, atestados, ponto e outros
            assuntos relacionados ao RH.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/abrir" className="botao-primario w-full sm:w-auto">
              Registrar solicitação
            </Link>
            <Link href="/consulta" className="botao-secundario w-full sm:w-auto">
              Acompanhar pelo protocolo
            </Link>
          </div>
        </section>

        <section className="mt-12 rounded-xl border border-tea-turquesa-200 bg-tea-turquesa-50 p-6 text-center">
          <p className="text-base font-bold text-tea-turquesa-800">
            📌 É simples: registre sua solicitação e acompanhe pelo número do protocolo.
          </p>
          <p className="mx-auto mt-2 max-w-3xl text-sm leading-relaxed text-slate-700">
            Assim, sua demanda fica registrada, chega ao time responsável e você consegue acompanhar
            cada etapa — sem precisar buscar atendimento por WhatsApp, e-mail ou ir até a sala do RH.
          </p>
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

        <section className="mt-14 text-center">
          <p className="text-lg font-bold text-tea-marinho">
            Um único canal, mais organização e um RH mais próximo de você. 🤝
          </p>
          <p className="mt-2 text-slate-600">Conte com a gente! 💙</p>
          <Link href="/abrir" className="botao-primario mt-6 inline-flex">
            Registrar minha solicitação
          </Link>
        </section>
      </main>

      <Rodape />
    </>
  );
}
