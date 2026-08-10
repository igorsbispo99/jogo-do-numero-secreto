"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { emailChamadoResolvido, emailNovaResposta } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAgente, supabaseServidor } from "@/lib/supabase/server";
import { tituloStatus } from "@/lib/dominio";
import { atualizarChamadoSchema, primeiroErro, respostaRhSchema } from "@/lib/validacao";

export type EstadoSimples =
  | { estado: "inicial" }
  | { estado: "erro"; mensagem: string }
  | { estado: "ok"; mensagem?: string };

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------

export async function entrar(_anterior: EstadoSimples, formData: FormData): Promise<EstadoSimples> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) return { estado: "erro", mensagem: "Informe e-mail e senha." };

  const supabase = await supabaseServidor();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error || !data.user) {
    return { estado: "erro", mensagem: "E-mail ou senha incorretos." };
  }

  const { data: perfil } = await supabase
    .from("rh_usuarios")
    .select("ativo")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!perfil?.ativo) {
    await supabase.auth.signOut();
    return { estado: "erro", mensagem: "Seu acesso ao painel está desativado. Fale com o admin." };
  }

  redirect("/rh");
}

export async function sair(): Promise<void> {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  redirect("/rh/login");
}

// ---------------------------------------------------------------------------
// Tratativa dos chamados
// ---------------------------------------------------------------------------

export async function responderChamado(
  _anterior: EstadoSimples,
  formData: FormData,
): Promise<EstadoSimples> {
  let agente;
  try {
    agente = await exigirAgente();
  } catch {
    return { estado: "erro", mensagem: "Sessão expirada. Faça login novamente." };
  }

  const analise = respostaRhSchema.safeParse({
    chamadoId: formData.get("chamadoId"),
    mensagem: formData.get("mensagem"),
    interna: formData.get("interna") === "on" || formData.get("interna") === "true",
    novoStatus: formData.get("novoStatus") || undefined,
  });
  if (!analise.success) return { estado: "erro", mensagem: primeiroErro(analise.error) };

  const { chamadoId, mensagem, interna, novoStatus } = analise.data;
  const supabase = supabaseAdmin();

  const { data: chamado } = await supabase
    .from("chamados")
    .select("id, protocolo, solicitante_nome, solicitante_email, status, primeira_resposta_em")
    .eq("id", chamadoId)
    .maybeSingle();

  if (!chamado) return { estado: "erro", mensagem: "Chamado não encontrado." };

  await supabase.from("chamado_mensagens").insert({
    chamado_id: chamado.id,
    autor_tipo: "rh",
    autor_nome: agente.nome,
    autor_id: agente.id,
    corpo: mensagem,
    interna,
  });

  const atualizacao: Record<string, unknown> = {};
  if (!interna && !chamado.primeira_resposta_em) {
    atualizacao.primeira_resposta_em = new Date().toISOString();
  }

  const statusFinal = novoStatus ?? (interna ? chamado.status : "aguardando_colaborador");
  if (statusFinal !== chamado.status) {
    atualizacao.status = statusFinal;
    if (statusFinal === "resolvido") atualizacao.resolvido_em = new Date().toISOString();
  }

  if (Object.keys(atualizacao).length > 0) {
    await supabase.from("chamados").update(atualizacao).eq("id", chamado.id);
  }

  if (statusFinal !== chamado.status) {
    await supabase.from("chamado_eventos").insert({
      chamado_id: chamado.id,
      autor_nome: agente.nome,
      descricao: `Andamento atualizado: ${tituloStatus(statusFinal)}`,
      publico: true,
    });
  }

  if (!interna) {
    await emailNovaResposta({
      para: chamado.solicitante_email,
      nome: chamado.solicitante_nome,
      protocolo: chamado.protocolo,
      autor: agente.nome,
      trecho: mensagem.length > 220 ? `${mensagem.slice(0, 220)}...` : mensagem,
    });
    if (statusFinal === "resolvido") {
      await emailChamadoResolvido({
        para: chamado.solicitante_email,
        nome: chamado.solicitante_nome,
        protocolo: chamado.protocolo,
      });
    }
  }

  revalidatePath(`/rh/chamados/${chamado.id}`);
  revalidatePath("/rh");
  return { estado: "ok", mensagem: interna ? "Nota interna registrada." : "Resposta enviada." };
}

export async function atualizarChamado(
  _anterior: EstadoSimples,
  formData: FormData,
): Promise<EstadoSimples> {
  let agente;
  try {
    agente = await exigirAgente();
  } catch {
    return { estado: "erro", mensagem: "Sessão expirada. Faça login novamente." };
  }

  const responsavelBruto = formData.get("responsavelId");
  const analise = atualizarChamadoSchema.safeParse({
    chamadoId: formData.get("chamadoId"),
    status: formData.get("status") || undefined,
    prioridade: formData.get("prioridade") || undefined,
    responsavelId:
      responsavelBruto === null || responsavelBruto === ""
        ? undefined
        : responsavelBruto === "ninguem"
          ? null
          : responsavelBruto,
  });
  if (!analise.success) return { estado: "erro", mensagem: primeiroErro(analise.error) };

  const { chamadoId, status, prioridade, responsavelId } = analise.data;
  const supabase = supabaseAdmin();

  const { data: chamado } = await supabase
    .from("chamados")
    .select("id, status, prioridade, responsavel_id, protocolo, solicitante_email, solicitante_nome")
    .eq("id", chamadoId)
    .maybeSingle();

  if (!chamado) return { estado: "erro", mensagem: "Chamado não encontrado." };

  const atualizacao: Record<string, unknown> = {};
  // "publico" define o que o colaborador enxerga no acompanhamento: o andamento
  // do chamado sim, o remanejamento interno do RH não.
  const eventos: { descricao: string; publico: boolean }[] = [];

  if (status && status !== chamado.status) {
    atualizacao.status = status;
    if (status === "resolvido") atualizacao.resolvido_em = new Date().toISOString();
    eventos.push({ descricao: `Andamento atualizado: ${tituloStatus(status)}`, publico: true });
  }
  if (prioridade && prioridade !== chamado.prioridade) {
    atualizacao.prioridade = prioridade;
    eventos.push({ descricao: `Prioridade alterada para "${prioridade}"`, publico: false });
  }
  if (responsavelId !== undefined && responsavelId !== chamado.responsavel_id) {
    atualizacao.responsavel_id = responsavelId;
    if (responsavelId === null) {
      eventos.push({ descricao: "Responsável removido", publico: false });
    } else {
      const { data: novo } = await supabase
        .from("rh_usuarios")
        .select("nome")
        .eq("id", responsavelId)
        .maybeSingle();
      eventos.push({
        descricao: `Atribuído para ${novo?.nome ?? "outro agente"}`,
        publico: false,
      });
    }
  }

  if (Object.keys(atualizacao).length === 0) return { estado: "ok" };

  await supabase.from("chamados").update(atualizacao).eq("id", chamado.id);

  if (eventos.length > 0) {
    await supabase.from("chamado_eventos").insert(
      eventos.map((evento) => ({
        chamado_id: chamado.id,
        autor_nome: agente.nome,
        descricao: evento.descricao,
        publico: evento.publico,
      })),
    );
  }

  if (status === "resolvido" && chamado.status !== "resolvido") {
    await emailChamadoResolvido({
      para: chamado.solicitante_email,
      nome: chamado.solicitante_nome,
      protocolo: chamado.protocolo,
    });
  }

  revalidatePath(`/rh/chamados/${chamado.id}`);
  revalidatePath("/rh");
  return { estado: "ok" };
}

/** Assume o chamado para si com um clique. */
export async function assumirChamado(formData: FormData): Promise<void> {
  const agente = await exigirAgente();
  const chamadoId = String(formData.get("chamadoId") ?? "");
  if (!chamadoId) return;

  const supabase = supabaseAdmin();
  const { data: chamado } = await supabase
    .from("chamados")
    .select("status")
    .eq("id", chamadoId)
    .maybeSingle();

  await supabase
    .from("chamados")
    .update({
      responsavel_id: agente.id,
      status: chamado?.status === "aberto" ? "em_andamento" : chamado?.status,
    })
    .eq("id", chamadoId);

  await supabase.from("chamado_eventos").insert({
    chamado_id: chamadoId,
    autor_nome: agente.nome,
    descricao: `${agente.nome}, do RH, assumiu o atendimento`,
    publico: true,
  });

  revalidatePath(`/rh/chamados/${chamadoId}`);
  revalidatePath("/rh");
}
