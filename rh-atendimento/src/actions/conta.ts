"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { emailSenhaAlterada, urlBase } from "@/lib/email";
import { formatarDataHora } from "@/lib/format";
import { registrarTentativa } from "@/lib/limite";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { agenteAtual, exigirAgente, supabaseServidor, type AgenteRh } from "@/lib/supabase/server";
import type { EstadoSimples } from "./rh";

/**
 * Conta do RH: troca de senha, recuperação por e-mail, preferência do resumo
 * diário e, para administradores, quem recebe os e-mails de gestão e triagem.
 *
 * Senhas nunca são gravadas, registradas em log ou enviadas por e-mail: o
 * Supabase Auth guarda só o hash. Fica registrado apenas que a senha mudou,
 * por quem e quando.
 */

const TAMANHO_MINIMO = 10;
// O bcrypt usado pelo Supabase ignora o que passa de 72 bytes.
const TAMANHO_MAXIMO = 72;

function validarNovaSenha(nova: string, confirmacao: string, atual?: string): string | null {
  if (nova.length < TAMANHO_MINIMO) return `A nova senha precisa ter pelo menos ${TAMANHO_MINIMO} caracteres.`;
  if (new TextEncoder().encode(nova).length > TAMANHO_MAXIMO) return "A nova senha é longa demais (máximo de 72 caracteres).";
  if (!/[A-Za-zÀ-ÿ]/.test(nova) || !/\d/.test(nova)) return "Use letras e números na nova senha.";
  if (nova !== confirmacao) return "A confirmação não é igual à nova senha.";
  if (atual !== undefined && nova === atual) return "A nova senha precisa ser diferente da atual.";
  return null;
}

async function registrarAuditoria(usuarioId: string, acao: string) {
  const { error } = await supabaseAdmin().from("rh_auditoria").insert({ usuario_id: usuarioId, acao });
  if (error) console.error("[conta] auditoria não gravada:", error.message);
}

/** Grava a nova senha, derruba as outras sessões e avisa a pessoa por e-mail. */
async function trocarSenha(agente: AgenteRh, nova: string, como: "troca" | "recuperacao") {
  const { error } = await supabaseAdmin().auth.admin.updateUserById(agente.id, { password: nova });
  if (error) {
    console.error("[conta] falha ao gravar a senha:", error.message);
    return error.message.toLowerCase().includes("weak") || error.message.toLowerCase().includes("pwned")
      ? "O Supabase recusou essa senha por ser fraca ou já ter vazado em outro site. Escolha outra."
      : "Não consegui gravar a nova senha. Tente novamente em instantes.";
  }

  // Quem estava conectado com a senha antiga em outro aparelho sai na hora.
  const supabase = await supabaseServidor();
  await supabase.auth.signOut({ scope: "others" });

  await registrarAuditoria(agente.id, como === "troca" ? "senha alterada em Minha conta" : "senha redefinida por link de recuperação");
  await emailSenhaAlterada({ para: agente.email, nome: agente.nome, quando: formatarDataHora(new Date()), como });
  return null;
}

export async function alterarSenha(_anterior: EstadoSimples, formData: FormData): Promise<EstadoSimples> {
  let agente;
  try {
    agente = await exigirAgente();
  } catch {
    return { estado: "erro", mensagem: "Sessão expirada. Faça login novamente." };
  }

  const dentroDoLimite = await registrarTentativa(`senha:${agente.id}`, 5, 15);
  if (!dentroDoLimite) {
    return { estado: "erro", mensagem: "Muitas tentativas seguidas. Aguarde 15 minutos e tente de novo." };
  }

  const atual = String(formData.get("senhaAtual") ?? "");
  const nova = String(formData.get("novaSenha") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");
  if (!atual) return { estado: "erro", mensagem: "Informe a senha atual." };

  const erro = validarNovaSenha(nova, confirmacao, atual);
  if (erro) return { estado: "erro", mensagem: erro };

  // Confere a senha atual num cliente à parte, sem tocar na sessão do navegador.
  const verificador = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: erroLogin } = await verificador.auth.signInWithPassword({ email: agente.email, password: atual });
  if (erroLogin) return { estado: "erro", mensagem: "A senha atual não confere." };
  // A conferência abre uma sessão própria: encerra na hora, ela não serve para mais nada.
  await verificador.auth.signOut({ scope: "local" });

  const falha = await trocarSenha(agente, nova, "troca");
  if (falha) return { estado: "erro", mensagem: falha };

  return {
    estado: "ok",
    mensagem: "Senha alterada. Os outros aparelhos conectados foram desconectados e você recebeu um aviso por e-mail.",
  };
}

// ---------------------------------------------------------------------------
// Esqueci minha senha
// ---------------------------------------------------------------------------

export async function pedirRecuperacao(_anterior: EstadoSimples, formData: FormData): Promise<EstadoSimples> {
  const resposta: EstadoSimples = {
    estado: "ok",
    mensagem:
      "Se este e-mail estiver cadastrado no Painel do RH, você vai receber um link para criar uma nova senha. Confira também o spam.",
  };

  const dentroDoLimite = await registrarTentativa("recuperar-senha", 5, 60);
  if (!dentroDoLimite) {
    return { estado: "erro", mensagem: "Muitos pedidos deste dispositivo. Tente novamente em uma hora." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { estado: "erro", mensagem: "Informe um e-mail válido." };

  // Só pede o link para quem é do RH e está ativo. A resposta é sempre a mesma,
  // para a tela não revelar quais e-mails existem.
  const { data: pessoa } = await supabaseAdmin()
    .from("rh_usuarios")
    .select("id, ativo")
    .eq("email", email)
    .maybeSingle();
  if (!pessoa?.ativo) return resposta;

  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${urlBase()}/rh/auth/confirmar`,
  });
  if (error) console.error("[conta] pedido de recuperação falhou:", error.message);
  else await registrarAuditoria(pessoa.id, "pedido de recuperação de senha");

  return resposta;
}

export async function definirNovaSenha(_anterior: EstadoSimples, formData: FormData): Promise<EstadoSimples> {
  const agente = await agenteAtual();
  if (!agente) {
    return { estado: "erro", mensagem: "O link expirou ou já foi usado. Peça um novo em “Esqueci minha senha”." };
  }

  const nova = String(formData.get("novaSenha") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");
  const erro = validarNovaSenha(nova, confirmacao);
  if (erro) return { estado: "erro", mensagem: erro };

  const falha = await trocarSenha(agente, nova, "recuperacao");
  if (falha) return { estado: "erro", mensagem: falha };

  redirect("/rh");
}

// ---------------------------------------------------------------------------
// Resumo diário e destinatários
// ---------------------------------------------------------------------------

export async function alternarResumo(formData: FormData): Promise<void> {
  const agente = await exigirAgente();
  const receber = formData.get("receber") === "sim";
  const { error } = await supabaseAdmin().from("rh_usuarios").update({ recebe_resumo: receber }).eq("id", agente.id);
  if (error) console.error("[conta] preferência de resumo:", error.message);
  revalidatePath("/rh/conta");
}

export async function adicionarDestinatario(_anterior: EstadoSimples, formData: FormData): Promise<EstadoSimples> {
  const agente = await agenteAtual();
  if (agente?.papel !== "admin") return { estado: "erro", mensagem: "Só administradores mudam os destinatários." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const papel = String(formData.get("papel") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { estado: "erro", mensagem: "Informe um e-mail válido." };
  if (papel !== "gestao" && papel !== "triagem") return { estado: "erro", mensagem: "Escolha o tipo de aviso." };

  const { error } = await supabaseAdmin()
    .from("notificacao_destinatarios")
    .upsert({ email, papel, ativo: true }, { onConflict: "email,papel" });
  if (error) {
    console.error("[conta] destinatário:", error.message);
    return { estado: "erro", mensagem: "Não consegui salvar. O banco já recebeu a atualização (schema.sql)?" };
  }
  revalidatePath("/rh/conta");
  return { estado: "ok", mensagem: `${email} adicionado.` };
}

export async function removerDestinatario(formData: FormData): Promise<void> {
  const agente = await agenteAtual();
  if (agente?.papel !== "admin") return;
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await supabaseAdmin().from("notificacao_destinatarios").delete().eq("id", id);
  revalidatePath("/rh/conta");
}
