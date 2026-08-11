import type { Metadata } from "next";
import { Cabecalho } from "@/components/Cabecalho";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Página de diagnóstico da instalação.
 *
 * Serve para descobrir, sem precisar ler log de servidor, o que está impedindo
 * o sistema de funcionar: variável de ambiente faltando, banco sem as tabelas,
 * bucket de anexos ausente. Ela testa a gravação de verdade - cria e apaga um
 * registro de teste - porque é esse o caminho que o formulário percorre.
 *
 * Não mostra nenhum segredo: apenas se a variável existe, nunca o valor dela.
 */

export const metadata: Metadata = {
  title: "Diagnóstico · RH Grupo TEA",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Item = { titulo: string; ok: boolean; detalhe?: string; opcional?: boolean };

const TABELAS = [
  "chamados",
  "chamado_mensagens",
  "chamado_anexos",
  "chamado_eventos",
  "rh_usuarios",
  "consulta_tentativas",
];

async function conferir(): Promise<{ itens: Item[]; conclusao: string }> {
  const itens: Item[] = [];

  const variaveis: [string, boolean, boolean?][] = [
    ["NEXT_PUBLIC_SUPABASE_URL", Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)],
    ["SUPABASE_SERVICE_ROLE_KEY", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)],
    ["NEXT_PUBLIC_URL_BASE", Boolean(process.env.NEXT_PUBLIC_URL_BASE), true],
    ["RESEND_API_KEY", Boolean(process.env.RESEND_API_KEY), true],
    ["EMAIL_AVISO_RH", Boolean(process.env.EMAIL_AVISO_RH), true],
  ];

  for (const [nome, existe, opcional] of variaveis) {
    itens.push({
      titulo: `Variável ${nome}`,
      ok: existe,
      opcional,
      detalhe: existe
        ? undefined
        : opcional
          ? "Sem ela o sistema roda, mas os e-mails não são enviados."
          : "Cadastre em Vercel › Settings › Environment Variables e faça Redeploy.",
    });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      itens,
      conclusao:
        "Faltam variáveis obrigatórias do Supabase. Cadastre-as na Vercel e faça um Redeploy.",
    };
  }

  const supabase = supabaseAdmin();
  let faltaTabela = false;

  for (const tabela of TABELAS) {
    const { error } = await supabase.from(tabela).select("id", { head: true, count: "exact" });
    if (error) faltaTabela = true;
    itens.push({
      titulo: `Tabela ${tabela}`,
      ok: !error,
      detalhe: error ? `${error.code ?? "erro"} · ${error.message}` : undefined,
    });
  }

  // Coluna acrescentada depois: sem ela, a linha do tempo não funciona.
  const { error: erroPublico } = await supabase
    .from("chamado_eventos")
    .select("publico", { head: true, count: "exact" });
  itens.push({
    titulo: "Coluna chamado_eventos.publico (linha do tempo)",
    ok: !erroPublico,
    detalhe: erroPublico ? "Rode o schema.sql de novo para acrescentá-la." : undefined,
  });

  const { data: buckets, error: erroBucket } = await supabase.storage.listBuckets();
  const temBucket = Boolean(buckets?.some((b) => b.id === "anexos"));
  itens.push({
    titulo: 'Bucket de anexos ("anexos")',
    ok: temBucket,
    detalhe: erroBucket
      ? erroBucket.message
      : temBucket
        ? undefined
        : "Não encontrado. O schema.sql cria o bucket.",
  });

  // Teste real de gravação: mesmo caminho do formulário.
  let erroGravacao: string | undefined;
  if (!faltaTabela) {
    const { data, error } = await supabase
      .from("chamados")
      .insert({
        solicitante_nome: "Teste Diagnostico",
        solicitante_email: "diagnostico@teste.local",
        solicitante_cpf: "00000000000",
        vinculo: "clt",
        categoria: "diagnostico",
        subcategoria: "diagnostico",
        assunto: "Teste automático de gravação",
        descricao: "Registro criado pela página de diagnóstico e apagado em seguida.",
      })
      .select("id")
      .single();

    if (error) erroGravacao = `${error.code ?? "erro"} · ${error.message}`;
    if (data?.id) await supabase.from("chamados").delete().eq("id", data.id);
  }

  itens.push({
    titulo: "Gravação de uma solicitação (teste real)",
    ok: !faltaTabela && !erroGravacao,
    detalhe: faltaTabela
      ? "Não testado: há tabela faltando."
      : (erroGravacao ?? "Criado e apagado com sucesso."),
  });

  const obrigatoriosOk = itens.every((i) => i.ok || i.opcional);
  const conclusao = obrigatoriosOk
    ? "Tudo certo: o sistema consegue registrar solicitações."
    : faltaTabela || !temBucket
      ? "O banco ainda não está preparado. Rode o arquivo supabase/schema.sql no SQL Editor do Supabase (pode rodar de novo sem medo, ele não apaga dados)."
      : "Veja os itens marcados em vermelho acima.";

  return { itens, conclusao };
}

export default async function PaginaDiagnostico() {
  let itens: Item[] = [];
  let conclusao = "";

  try {
    const resultado = await conferir();
    itens = resultado.itens;
    conclusao = resultado.conclusao;
  } catch (erro) {
    conclusao = `Falha ao executar o diagnóstico: ${erro instanceof Error ? erro.message : "erro desconhecido"}`;
  }

  const tudoOk = itens.length > 0 && itens.every((i) => i.ok || i.opcional);

  return (
    <>
      <Cabecalho compacto />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-tea-marinho">Diagnóstico da instalação</h1>
        <p className="mt-2 text-slate-600">
          Confere se o sistema está conectado ao banco e pronto para receber solicitações.
        </p>

        <div
          className={`mt-6 rounded-xl border p-5 ${
            tudoOk
              ? "border-tea-turquesa-200 bg-tea-turquesa-50"
              : "border-tea-laranja-200 bg-tea-laranja-50"
          }`}
        >
          <p
            className={`font-bold ${tudoOk ? "text-tea-turquesa-800" : "text-tea-laranja-800"}`}
          >
            {conclusao}
          </p>
        </div>

        <ul className="cartao mt-6 divide-y divide-slate-100">
          {itens.map((item) => (
            <li key={item.titulo} className="flex gap-3 p-4">
              <span aria-hidden className="text-lg leading-none">
                {item.ok ? "✅" : item.opcional ? "⚠️" : "❌"}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {item.titulo}
                  {item.opcional && !item.ok && (
                    <span className="ml-2 text-xs font-normal text-slate-500">(opcional)</span>
                  )}
                </p>
                {item.detalhe && (
                  <p className="mt-0.5 break-words text-xs text-slate-600">{item.detalhe}</p>
                )}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs leading-relaxed text-slate-500">
          Esta página mostra apenas se cada variável foi configurada — nunca o valor dela. Ela é
          útil na implantação e em manutenções; depois que o sistema estiver estável, pode ser
          removida apagando a pasta <code>src/app/diagnostico</code>.
        </p>
      </main>
    </>
  );
}
