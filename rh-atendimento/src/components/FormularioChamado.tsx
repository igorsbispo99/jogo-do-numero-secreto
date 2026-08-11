"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { abrirChamado, type EstadoAbertura } from "@/actions/publico";
import { CampoAnexos } from "@/components/CampoAnexos";
import { FaixaMarca } from "@/components/Logo";
import {
  type CampoExtra,
  categoriasDo,
  type Categoria,
  type Subcategoria,
  type VinculoSlug,
  VINCULOS,
} from "@/lib/catalogo";
import { mascararCpf } from "@/lib/format";

const ESTADO_INICIAL: EstadoAbertura = { estado: "inicial" };

/* As categorias se revezam nas cinco cores da marca, para ficar mais fácil
   reconhecer visualmente o caminho percorrido.
   Usa sombra interna (e não borda) porque a classe .cartao já define a borda
   do card e venceria a disputa de estilo. */
const ACENTOS = [
  "shadow-[inset_5px_0_0_0_var(--color-tea-azul-500)]",
  "shadow-[inset_5px_0_0_0_var(--color-tea-turquesa-500)]",
  "shadow-[inset_5px_0_0_0_var(--color-tea-ambar-500)]",
  "shadow-[inset_5px_0_0_0_var(--color-tea-laranja-500)]",
  "shadow-[inset_5px_0_0_0_var(--color-tea-vinho-500)]",
];

export function FormularioChamado() {
  const [estado, acao] = useActionState(abrirChamado, ESTADO_INICIAL);
  const [vinculo, setVinculo] = useState<VinculoSlug | null>(null);
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [subcategoria, setSubcategoria] = useState<Subcategoria | null>(null);
  const [cpf, setCpf] = useState("");
  /* Respostas dos campos específicos do assunto. Ficam no estado porque um
     campo pode depender da resposta de outro - por exemplo, o e-mail
     corporativo só é pedido a quem disse que tem um. */
  const [extras, setExtras] = useState<Record<string, string>>({});

  const anotarExtra = (nome: string, valor: string) =>
    setExtras((atuais) => ({ ...atuais, [nome]: valor }));

  const visivel = (campo: CampoExtra) =>
    !campo.mostrarSe || extras[campo.mostrarSe.campo] === campo.mostrarSe.valor;

  if (estado.estado === "ok") {
    return <Sucesso protocolo={estado.protocolo} email={estado.email} />;
  }

  const passo = !vinculo ? 1 : !categoria ? 2 : !subcategoria ? 3 : 4;

  return (
    <div>
      <Trilha
        passo={passo}
        vinculo={vinculo}
        categoria={categoria}
        subcategoria={subcategoria}
        aoVoltar={(destino) => {
          if (destino <= 1) setVinculo(null);
          if (destino <= 2) setCategoria(null);
          if (destino <= 3) setSubcategoria(null);
          setExtras({});
        }}
      />

      {passo === 1 && (
        <Passo titulo="Qual é o seu vínculo com o Grupo TEA?">
          <div className="grid gap-3 sm:grid-cols-3">
            {VINCULOS.map((opcao) => (
              <button
                key={opcao.slug}
                type="button"
                onClick={() => setVinculo(opcao.slug)}
                className="cartao p-5 text-left transition hover:border-tea-turquesa-600 hover:bg-tea-turquesa-50"
              >
                <span className="block text-base font-bold text-slate-900">{opcao.titulo}</span>
                <span className="mt-1 block text-sm text-slate-500">{opcao.descricao}</span>
              </button>
            ))}
          </div>
        </Passo>
      )}

      {passo === 2 && vinculo && (
        <Passo titulo="Sobre o que é a sua solicitação?">
          <div className="grid gap-3 sm:grid-cols-2">
            {categoriasDo(vinculo).map((opcao, indice) => (
              <button
                key={opcao.slug}
                type="button"
                onClick={() => setCategoria(opcao)}
                className={`cartao p-4 text-left transition hover:bg-tea-turquesa-50 ${
                  ACENTOS[indice % ACENTOS.length]
                }`}
              >
                <span className="block font-bold text-slate-900">{opcao.titulo}</span>
                {opcao.descricao && (
                  <span className="mt-1 block text-sm text-slate-500">{opcao.descricao}</span>
                )}
              </button>
            ))}
          </div>
        </Passo>
      )}

      {passo === 3 && categoria && (
        <Passo titulo={`${categoria.titulo}: o que você precisa?`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {categoria.subcategorias.map((opcao) => (
              <button
                key={opcao.slug}
                type="button"
                onClick={() => {
                  setSubcategoria(opcao);
                  setExtras({});
                }}
                className="cartao p-4 text-left transition hover:border-tea-turquesa-600 hover:bg-tea-turquesa-50"
              >
                <span className="block font-semibold text-slate-900">{opcao.titulo}</span>
                {opcao.descricao && (
                  <span className="mt-1 block text-sm text-slate-500">{opcao.descricao}</span>
                )}
              </button>
            ))}
          </div>
        </Passo>
      )}

      {passo === 4 && vinculo && categoria && subcategoria && (
        <form action={acao} className="space-y-6">
          <input type="hidden" name="vinculo" value={vinculo} />
          <input type="hidden" name="categoria" value={categoria.slug} />
          <input type="hidden" name="subcategoria" value={subcategoria.slug} />

          <section className="cartao p-5">
            <h2 className="text-base font-bold text-slate-900">Seus dados</h2>
            <p className="mt-1 text-sm text-slate-500">
              Precisamos identificar você para localizar seu cadastro e responder no lugar certo.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="rotulo" htmlFor="nome">
                  Nome completo *
                </label>
                <input id="nome" name="nome" required className="campo" autoComplete="name" />
              </div>

              <div>
                <label className="rotulo" htmlFor="email">
                  E-mail *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="campo"
                  autoComplete="email"
                  inputMode="email"
                />
                <p className="mt-1 text-xs text-slate-500">
                  É para lá que vai o protocolo e as respostas.
                </p>
              </div>

              <div>
                <label className="rotulo" htmlFor="cpf">
                  CPF *
                </label>
                <input
                  id="cpf"
                  name="cpf"
                  required
                  className="campo"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(mascararCpf(e.target.value))}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Usado só para identificação e para você acompanhar o chamado.
                </p>
              </div>

              <div>
                <label className="rotulo" htmlFor="telefone">
                  Telefone / WhatsApp
                </label>
                <input
                  id="telefone"
                  name="telefone"
                  className="campo"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>

              <div>
                <label className="rotulo" htmlFor="unidade">
                  Unidade / setor
                </label>
                <input id="unidade" name="unidade" className="campo" />
              </div>
            </div>
          </section>

          <section className="cartao p-5">
            <h2 className="text-base font-bold text-slate-900">
              {categoria.titulo} › {subcategoria.titulo}
            </h2>

            {(subcategoria.campos?.length ?? 0) > 0 && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {(subcategoria.campos ?? []).filter(visivel).map((campo) => (
                  <div
                    key={campo.nome}
                    className={campo.tipo === "textarea" ? "sm:col-span-2" : undefined}
                  >
                    <label className="rotulo" htmlFor={`extra_${campo.nome}`}>
                      {campo.label} {campo.obrigatorio && "*"}
                    </label>

                    {campo.tipo === "select" ? (
                      <select
                        id={`extra_${campo.nome}`}
                        name={`extra_${campo.nome}`}
                        className="campo"
                        required={campo.obrigatorio}
                        value={extras[campo.nome] ?? ""}
                        onChange={(e) => anotarExtra(campo.nome, e.target.value)}
                      >
                        <option value="" disabled>
                          Selecione
                        </option>
                        {campo.opcoes?.map((opcao) => (
                          <option key={opcao} value={opcao}>
                            {opcao}
                          </option>
                        ))}
                      </select>
                    ) : campo.tipo === "textarea" ? (
                      <textarea
                        id={`extra_${campo.nome}`}
                        name={`extra_${campo.nome}`}
                        className="campo"
                        rows={3}
                        required={campo.obrigatorio}
                        value={extras[campo.nome] ?? ""}
                        onChange={(e) => anotarExtra(campo.nome, e.target.value)}
                      />
                    ) : (
                      <input
                        id={`extra_${campo.nome}`}
                        name={`extra_${campo.nome}`}
                        className="campo"
                        required={campo.obrigatorio}
                        value={extras[campo.nome] ?? ""}
                        onChange={(e) => anotarExtra(campo.nome, e.target.value)}
                        type={
                          campo.tipo === "data" ? "date" : campo.tipo === "numero" ? "number" : "text"
                        }
                        step={campo.tipo === "numero" ? "any" : undefined}
                      />
                    )}

                    {campo.ajuda && <p className="mt-1 text-xs text-slate-500">{campo.ajuda}</p>}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <label className="rotulo" htmlFor="descricao">
                Descreva sua solicitação {subcategoria.descricaoDispensavel ? "(opcional)" : "*"}
              </label>
              <textarea
                id="descricao"
                name="descricao"
                rows={5}
                required={!subcategoria.descricaoDispensavel}
                minLength={subcategoria.descricaoDispensavel ? undefined : 15}
                className="campo"
                placeholder="Conte o que aconteceu e o que você precisa. Quanto mais claro, mais rápido o RH resolve."
              />
            </div>

            <div className="mt-4">
              <label className="rotulo" htmlFor="anexos">
                Anexos {subcategoria.anexoObrigatorio ? "*" : "(opcional)"}
              </label>
              <CampoAnexos
                id="anexos"
                obrigatorio={subcategoria.anexoObrigatorio}
                ajuda={subcategoria.anexoAjuda}
              />
            </div>
          </section>

          {estado.estado === "erro" && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-600/20"
            >
              {estado.mensagem}
            </p>
          )}

          <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => setSubcategoria(null)}
              className="botao-secundario w-full sm:w-auto"
            >
              Voltar
            </button>
            <BotaoEnviar />
          </div>

          <p className="text-center text-xs leading-relaxed text-slate-500">
            Ao enviar, você autoriza o RH do Grupo TEA a tratar os dados e documentos informados para
            atender esta solicitação, conforme a LGPD.
          </p>
        </form>
      )}
    </div>
  );
}

function BotaoEnviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="botao-primario w-full sm:w-auto">
      {pending ? "Enviando..." : "Enviar solicitação"}
    </button>
  );
}

function Passo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-slate-900">{titulo}</h2>
      {children}
    </section>
  );
}

function Trilha({
  passo,
  vinculo,
  categoria,
  subcategoria,
  aoVoltar,
}: {
  passo: number;
  vinculo: VinculoSlug | null;
  categoria: Categoria | null;
  subcategoria: Subcategoria | null;
  aoVoltar: (destino: number) => void;
}) {
  const itens = [
    { rotulo: VINCULOS.find((v) => v.slug === vinculo)?.titulo, destino: 1 },
    { rotulo: categoria?.titulo, destino: 2 },
    { rotulo: subcategoria?.titulo, destino: 3 },
  ].filter((item) => item.rotulo);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-slate-500">Passo {passo} de 4</span>
      {itens.map((item) => (
        <span key={item.destino} className="flex items-center gap-2">
          <span aria-hidden className="text-slate-300">
            /
          </span>
          <button
            type="button"
            onClick={() => aoVoltar(item.destino)}
            className="rounded font-semibold text-tea-turquesa-700 underline-offset-4 hover:underline"
          >
            {item.rotulo}
          </button>
        </span>
      ))}
    </div>
  );
}

function Sucesso({ protocolo, email }: { protocolo: string; email: string }) {
  return (
    <div className="cartao overflow-hidden text-center">
      <FaixaMarca />
      <div className="p-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-tea-turquesa-100 text-2xl text-tea-turquesa-800">
        ✓
      </div>
      <h2 className="mt-4 text-xl font-bold text-tea-marinho">Solicitação registrada 💙</h2>
      <p className="mt-2 text-slate-600">
        Sua demanda já chegou ao time responsável. Guarde o número do seu protocolo:
      </p>

      <p className="mx-auto mt-4 w-fit rounded-lg bg-tea-marinho px-6 py-3 font-mono text-xl font-bold tracking-wider text-white">
        {protocolo}
      </p>

      <p className="mt-4 text-sm text-slate-600">
        Enviamos uma confirmação para <strong>{email}</strong>. Com o protocolo e o seu CPF você
        acompanha cada etapa e responde ao RH a qualquer momento. Conte com a gente!
      </p>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href={`/consulta?protocolo=${encodeURIComponent(protocolo)}`}
          className="botao-primario w-full sm:w-auto"
        >
          Acompanhar este chamado
        </Link>
        {/* Âncora normal (e não Link): força recarregar a página para o
            formulário voltar do zero. */}
        <a href="/abrir" className="botao-secundario w-full sm:w-auto">
          Abrir outro chamado
        </a>
      </div>
      </div>
    </div>
  );
}
