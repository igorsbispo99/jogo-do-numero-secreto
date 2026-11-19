import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { alternarResumo, removerDestinatario } from "@/actions/conta";
import { CabecalhoRh } from "@/components/CabecalhoRh";
import { FormularioAlterarSenha, FormularioDestinatario } from "@/components/FormulariosConta";
import { agenteAtual, supabaseServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Minha conta · RH Grupo TEA" };
export const dynamic = "force-dynamic";

const PAPEL: Record<string, string> = {
  gestao: "Resumo da gestão e aviso de Crítico",
  triagem: "Avisos de triagem e aviso de Crítico",
};

export default async function PaginaConta() {
  const agente = await agenteAtual();
  if (!agente) redirect("/rh/login");

  const supabase = await supabaseServidor();
  const [{ data: perfil }, { data: destinatarios, error: erroDestinatarios }] = await Promise.all([
    supabase.from("rh_usuarios").select("recebe_resumo").eq("id", agente.id).maybeSingle(),
    supabase.from("notificacao_destinatarios").select("id, email, papel, ativo").order("papel").order("email"),
  ]);
  const recebeResumo = perfil?.recebe_resumo !== false;
  const admin = agente.papel === "admin";

  return (
    <>
      <CabecalhoRh agente={agente} />

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-bold text-tea-marinho">Minha conta</h1>
          <p className="mt-1 text-sm text-slate-500">
            {agente.nome} · {agente.email}
            {admin && " · administrador"}
          </p>
        </div>

        <section className="cartao space-y-4 p-6" aria-labelledby="senha">
          <div>
            <h2 id="senha" className="text-base font-bold text-slate-900">
              Alterar senha
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Ao trocar, os outros computadores e celulares conectados com a sua conta são desconectados e você
              recebe um aviso por e-mail. Ninguém, nem os administradores, consegue ver a sua senha.
            </p>
          </div>
          <FormularioAlterarSenha />
        </section>

        <section className="cartao space-y-3 p-6" aria-labelledby="resumo">
          <h2 id="resumo" className="text-base font-bold text-slate-900">
            Resumo da manhã
          </h2>
          <p className="text-sm text-slate-500">
            Em dias úteis, às 7h30, um e-mail com os chamados atribuídos a você: quantos estão em aberto, vencidos e
            que vencem hoje e no próximo dia útil. Se você não tiver chamado em aberto, o e-mail não é enviado.
          </p>
          <form action={alternarResumo} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="receber" value={recebeResumo ? "nao" : "sim"} />
            <span className="text-sm font-semibold text-slate-700">
              {recebeResumo ? "Você recebe o resumo." : "Você não recebe o resumo."}
            </span>
            <button type="submit" className="botao-secundario">
              {recebeResumo ? "Deixar de receber" : "Voltar a receber"}
            </button>
          </form>
        </section>

        <section className="cartao space-y-4 p-6" aria-labelledby="avisos">
          <div>
            <h2 id="avisos" className="text-base font-bold text-slate-900">
              Quem recebe os avisos da central
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              O resumo da gestão sai em dias úteis às 7h30. A triagem recebe as pendências de classificação,
              atribuição e 1ª resposta. Os dois recebem na hora o aviso de chamado Crítico. Os e-mails levam só
              números e links, nunca dados de colaboradores.
              {!admin && " Só administradores mudam esta lista."}
            </p>
          </div>

          {erroDestinatarios ? (
            <p className="text-sm text-slate-500">
              A lista aparece depois que o banco recebe a atualização (supabase/schema.sql).
            </p>
          ) : (destinatarios ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum destinatário cadastrado ainda.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {(destinatarios ?? []).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="min-w-0 break-words">
                    <span className="block font-semibold text-slate-800">{d.email}</span>
                    <span className="text-xs text-slate-500">{PAPEL[d.papel] ?? d.papel}</span>
                  </span>
                  {admin && (
                    <form action={removerDestinatario}>
                      <input type="hidden" name="id" value={d.id} />
                      <button
                        type="submit"
                        className="text-xs font-semibold text-slate-500 hover:text-tea-vinho-600"
                      >
                        Remover
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}

          {admin && !erroDestinatarios && <FormularioDestinatario />}
        </section>
      </main>
    </>
  );
}
