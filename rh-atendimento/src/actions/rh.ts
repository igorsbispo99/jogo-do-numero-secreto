"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { lerAnexos, registrarAnexos, validarAnexos } from "@/lib/anexos";
import { emailChamadoResolvido, emailNovaResposta } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAgente, supabaseServidor } from "@/lib/supabase/server";
import { tituloStatus } from "@/lib/dominio";
import { formatarPrazo } from "@/lib/format";
import { calcularSla } from "@/lib/sla/calcular";
import { proximoPrazo } from "@/lib/sla/estado";
import {
  agravanteValido,
  NIVEIS_SLA,
  nivelValido,
  type AgravanteId,
  type NivelSla,
} from "@/lib/sla/regras";
import {
  aplicarPrevia,
  avisarCritico,
  colunasDoResultado,
  registrarTransicao,
  tituloAgravante,
} from "@/lib/sla/servidor";
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

  const anexos = lerAnexos(formData);
  const erroAnexo = validarAnexos(anexos);
  if (erroAnexo) return { estado: "erro", mensagem: erroAnexo };

  const { data: novaMensagem } = await supabase
    .from("chamado_mensagens")
    .insert({
      chamado_id: chamado.id,
      autor_tipo: "rh",
      autor_nome: agente.nome,
      autor_id: agente.id,
      corpo: mensagem,
      interna,
    })
    .select("id")
    .single();

  if (anexos.length > 0) {
    await registrarAnexos(chamado.id, anexos, novaMensagem?.id ?? null);
  }

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
    await registrarTransicao(chamado.id, {
      statusAnterior: chamado.status,
      status: statusFinal,
      primeiraRespostaEm: (atualizacao.primeira_resposta_em as string | undefined) ?? null,
    });
  }

  if (statusFinal !== chamado.status) {
    await supabase.from("chamado_eventos").insert({
      chamado_id: chamado.id,
      autor_nome: agente.nome,
      descricao: `Andamento atualizado: ${tituloStatus(statusFinal)}`,
      publico: true,
    });
  }

  // Notas internas não geram e-mail. Nas respostas, o colaborador recebe um
  // único aviso: o de encerramento já leva a resposta dentro, para não chegarem
  // dois e-mails ao mesmo tempo.
  if (!interna) {
    const trecho = mensagem.length > 220 ? `${mensagem.slice(0, 220)}...` : mensagem;
    const dadosBase = {
      para: chamado.solicitante_email,
      nome: chamado.solicitante_nome,
      protocolo: chamado.protocolo,
      autor: agente.nome,
      trecho,
      anexos: anexos.length,
    };

    if (statusFinal === "resolvido") {
      await emailChamadoResolvido(dadosBase);
    } else {
      await emailNovaResposta(dadosBase);
    }
  }

  revalidatePath(`/rh/chamados/${chamado.id}`);
  revalidatePath("/rh");
  return {
    estado: "ok",
    mensagem: interna
      ? "Nota interna registrada."
      : anexos.length > 0
        ? `Resposta enviada com ${anexos.length} anexo${anexos.length === 1 ? "" : "s"}.`
        : "Resposta enviada.",
  };
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
  if (atualizacao.status) {
    await registrarTransicao(chamado.id, { statusAnterior: chamado.status, status: status });
  }

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

/**
 * Apaga o arquivo do armazenamento assim que ele não for mais necessário.
 *
 * O registro do anexo continua no chamado, marcado com quem apagou e quando -
 * o histórico não pode ficar com buracos. Sem volta: o arquivo em si some.
 */
export async function removerAnexo(formData: FormData): Promise<void> {
  const agente = await exigirAgente();
  const anexoId = String(formData.get("anexoId") ?? "");
  if (!anexoId) return;

  const supabase = supabaseAdmin();
  const { data: anexo } = await supabase
    .from("chamado_anexos")
    .select("id, caminho, nome_arquivo, chamado_id, removido_em")
    .eq("id", anexoId)
    .maybeSingle();

  if (!anexo || anexo.removido_em) return;

  const { error } = await supabase.storage.from("anexos").remove([anexo.caminho]);
  if (error) console.error("[anexo] falha ao apagar:", error.message);

  await supabase
    .from("chamado_anexos")
    .update({ removido_em: new Date().toISOString(), removido_por: agente.nome })
    .eq("id", anexo.id);

  await supabase.from("chamado_eventos").insert({
    chamado_id: anexo.chamado_id,
    autor_nome: agente.nome,
    descricao: `Anexo "${anexo.nome_arquivo}" apagado do armazenamento`,
    publico: false,
  });

  revalidatePath(`/rh/chamados/${anexo.chamado_id}`);
}

/**
 * Marca (ou desmarca) o chamado como teste.
 *
 * Nada é apagado: o chamado continua acessível e o colaborador segue vendo o
 * dele normalmente. Ele só deixa de aparecer na fila e de contar nos
 * indicadores - é o que separa a homologação da operação de verdade.
 */
export async function alternarTeste(formData: FormData): Promise<void> {
  const agente = await exigirAgente();
  const chamadoId = String(formData.get("chamadoId") ?? "");
  if (!chamadoId) return;

  const supabase = supabaseAdmin();
  const { data: chamado } = await supabase
    .from("chamados")
    .select("id, de_teste")
    .eq("id", chamadoId)
    .maybeSingle();

  if (!chamado) return;
  const virandoTeste = !chamado.de_teste;

  await supabase.from("chamados").update({ de_teste: virandoTeste }).eq("id", chamado.id);

  await supabase.from("chamado_eventos").insert({
    chamado_id: chamado.id,
    autor_nome: agente.nome,
    descricao: virandoTeste
      ? "Chamado marcado como teste (fora dos indicadores)"
      : "Chamado voltou a contar nos indicadores",
    publico: false,
  });

  revalidatePath(`/rh/chamados/${chamado.id}`);
  revalidatePath("/rh");
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

// ---------------------------------------------------------------------------
// SLA: confirmar, revisar e calcular
// ---------------------------------------------------------------------------

const mesmoConjunto = (a: readonly string[] | null | undefined, b: readonly string[]) =>
  !!a && a.length === b.length && a.every((x) => b.includes(x));

/**
 * Oficializa o SLA do chamado: confirma a prévia como está ou grava a revisão
 * (detalhe do assunto, agravantes e, se preciso, ajuste manual do nível).
 *
 * Na primeira confirmação, compara com a prévia e guarda se ela acertou - é
 * esse número que mostra, em Indicadores, quando a classificação humana pode
 * diminuir.
 */
export async function classificarSla(
  _anterior: EstadoSimples,
  formData: FormData,
): Promise<EstadoSimples> {
  let agente;
  try {
    agente = await exigirAgente();
  } catch {
    return { estado: "erro", mensagem: "Sessão expirada. Faça login novamente." };
  }

  const chamadoId = String(formData.get("chamadoId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(chamadoId)) return { estado: "erro", mensagem: "Chamado inválido." };

  const agravantes = formData.getAll("agravante").filter(agravanteValido) as AgravanteId[];
  const variante = String(formData.get("variante") ?? "").trim() || null;
  const manualBruto = String(formData.get("nivelManual") ?? "");
  const nivelManual: NivelSla | null = nivelValido(manualBruto) ? manualBruto : null;
  const justificativa = String(formData.get("justificativa") ?? "").trim().slice(0, 500);

  if (nivelManual && justificativa.length < 5) {
    return { estado: "erro", mensagem: "Explique em poucas palavras o motivo do ajuste manual do nível." };
  }

  const supabase = supabaseAdmin();
  const { data: chamado, error } = await supabase
    .from("chamados")
    .select(
      "id, protocolo, vinculo, categoria, subcategoria, assunto, descricao, dados_extras, criado_em, status, primeira_resposta_em, sla_nivel, sla_previa_nivel, sla_previa_agravantes, sla_confirmado_em, sla_pausado_desde, sla_minutos_pausados",
    )
    .eq("id", chamadoId)
    .maybeSingle();

  if (error) {
    console.error("[sla] leitura para classificar:", error.message);
    return {
      estado: "erro",
      mensagem: "O banco ainda não tem a atualização de SLA. Peça para rodar o supabase/schema.sql.",
    };
  }
  if (!chamado) return { estado: "erro", mensagem: "Chamado não encontrado." };

  const resultado = calcularSla({
    vinculo: chamado.vinculo,
    categoria: chamado.categoria,
    subcategoria: chamado.subcategoria,
    dadosExtras: chamado.dados_extras,
    abertoEm: new Date(chamado.criado_em),
    agravantes,
    variante,
    nivelManual,
    texto: chamado.descricao,
  });

  const colunas = colunasDoResultado(resultado, chamado.sla_minutos_pausados ?? 0);
  const primeiraConfirmacao = !chamado.sla_confirmado_em;

  const atualizacao: Record<string, unknown> = {
    ...colunas,
    sla_nivel_manual: nivelManual,
    sla_justificativa: nivelManual ? justificativa : null,
    sla_confirmado_em: new Date().toISOString(),
    sla_confirmado_por: agente.id,
    sla_proximo_prazo: proximoPrazo({
      status: chamado.status,
      primeira_resposta_em: chamado.primeira_resposta_em,
      sla_primeira_resposta_ate: colunas.sla_primeira_resposta_ate,
      sla_resolucao_ate: colunas.sla_resolucao_ate,
      sla_pausado_desde: chamado.sla_pausado_desde,
    }),
  };
  if (primeiraConfirmacao && chamado.sla_previa_nivel) {
    atualizacao.sla_previa_correta = chamado.sla_previa_nivel === resultado.nivel;
    atualizacao.sla_previa_agravantes_corretos = mesmoConjunto(chamado.sla_previa_agravantes, resultado.agravantes);
  }

  const { error: erroUpdate } = await supabase.from("chamados").update(atualizacao).eq("id", chamado.id);
  if (erroUpdate) {
    console.error("[sla] gravar classificação:", erroUpdate.message);
    return { estado: "erro", mensagem: "Não consegui gravar a classificação. Tente de novo." };
  }

  const titulo = NIVEIS_SLA[resultado.nivel].titulo;
  const prazos = `1ª resposta até ${formatarPrazo(colunas.sla_primeira_resposta_ate)} · resolução até ${formatarPrazo(colunas.sla_resolucao_ate)}`;
  const mudouNivel = chamado.sla_nivel && chamado.sla_nivel !== resultado.nivel;
  const lista = resultado.agravantes.length
    ? ` Agravantes: ${resultado.agravantes.map(tituloAgravante).join("; ")}.`
    : "";
  await supabase.from("chamado_eventos").insert({
    chamado_id: chamado.id,
    autor_nome: agente.nome,
    descricao: mudouNivel
      ? `SLA revisado de ${NIVEIS_SLA[chamado.sla_nivel as NivelSla].titulo} para ${titulo} · ${prazos}.${lista}${nivelManual ? ` Ajuste manual: ${justificativa}` : ""}`
      : `SLA ${primeiraConfirmacao ? "confirmado" : "reconfirmado"}: ${titulo} · ${prazos}.${lista}`,
    publico: false,
  });

  if (resultado.nivel === "critica" && chamado.sla_nivel !== "critica") {
    await avisarCritico({
      chamadoId: chamado.id,
      protocolo: chamado.protocolo,
      assunto: chamado.assunto,
      vinculo: chamado.vinculo,
      resultado,
      origem: "revisao",
    });
  }

  revalidatePath(`/rh/chamados/${chamado.id}`);
  revalidatePath("/rh");
  return {
    estado: "ok",
    mensagem: mudouNivel ? `SLA revisado para ${titulo}.` : `SLA confirmado: ${titulo}.`,
  };
}

/** Calcula a prévia de um chamado que chegou antes da regra de SLA existir. */
export async function calcularSlaChamado(formData: FormData): Promise<void> {
  await exigirAgente();
  const chamadoId = String(formData.get("chamadoId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(chamadoId)) return;

  const supabase = supabaseAdmin();
  const { data: chamado } = await supabase
    .from("chamados")
    .select(
      "id, protocolo, vinculo, categoria, subcategoria, assunto, dados_extras, descricao, solicitante_cpf, criado_em, status, primeira_resposta_em",
    )
    .eq("id", chamadoId)
    .maybeSingle();
  if (!chamado) return;

  const resultado = await aplicarPrevia({
    id: chamado.id,
    protocolo: chamado.protocolo,
    vinculo: chamado.vinculo,
    categoria: chamado.categoria,
    subcategoria: chamado.subcategoria,
    assunto: chamado.assunto,
    dadosExtras: chamado.dados_extras ?? {},
    descricao: chamado.descricao,
    cpf: chamado.solicitante_cpf,
    criadoEm: new Date(chamado.criado_em),
  });

  // A prévia parte de um chamado recém-aberto; aqui o chamado já andou.
  if (resultado) {
    await registrarTransicao(chamado.id, {
      statusAnterior: "aberto",
      status: chamado.status,
      primeiraRespostaEm: chamado.primeira_resposta_em,
    });
  }

  revalidatePath(`/rh/chamados/${chamado.id}`);
  revalidatePath("/rh");
}
