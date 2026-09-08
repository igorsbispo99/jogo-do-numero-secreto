"use server";

import {
  acharSubcategoria,
  rotuloAssunto,
  tituloVinculo,
  UNIDADES,
  type VinculoSlug,
} from "@/lib/catalogo";
import { assinarAnexos, lerAnexos, registrarAnexos, validarAnexos } from "@/lib/anexos";
import { emailAvisoRh, emailChamadoAberto } from "@/lib/email";
import { limparTentativasAntigas, registrarTentativa } from "@/lib/limite";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Anexo, AnexoComLink, Chamado, Mensagem } from "@/lib/tipos";
import {
  consultaSchema,
  novoChamadoSchema,
  primeiroErro,
  respostaColaboradorSchema,
  validarCamposExtras,
} from "@/lib/validacao";

export type EstadoAbertura =
  | { estado: "inicial" }
  | { estado: "erro"; mensagem: string }
  | { estado: "ok"; protocolo: string; email: string };

export type ChamadoPublico = {
  chamado: Pick<
    Chamado,
    | "protocolo"
    | "solicitante_nome"
    | "vinculo"
    | "categoria"
    | "subcategoria"
    | "assunto"
    | "descricao"
    | "dados_extras"
    | "status"
    | "criado_em"
    | "atualizado_em"
  >;
  mensagens: Pick<Mensagem, "id" | "autor_tipo" | "autor_nome" | "corpo" | "criado_em">[];
  anexos: AnexoComLink[];
  /** Etapas do atendimento, para o colaborador acompanhar o andamento. */
  etapas: { id: string; descricao: string; criado_em: string }[];
};

export type EstadoConsulta =
  | { estado: "inicial" }
  | { estado: "erro"; mensagem: string }
  | { estado: "ok"; dados: ChamadoPublico; protocolo: string; cpf: string };

// ---------------------------------------------------------------------------
// Anexos
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Abrir chamado
// ---------------------------------------------------------------------------

export async function abrirChamado(
  anterior: EstadoAbertura,
  formData: FormData,
): Promise<EstadoAbertura> {
  // Nenhuma falha inesperada pode virar tela de erro em branco para quem está
  // tentando registrar uma solicitação.
  try {
    return await registrarSolicitacao(anterior, formData);
  } catch (erro) {
    console.error("[chamado] exceção ao registrar:", erro);
    return {
      estado: "erro",
      mensagem:
        "Tivemos uma falha inesperada ao registrar sua solicitação. Tente novamente em instantes.",
    };
  }
}

async function registrarSolicitacao(
  _anterior: EstadoAbertura,
  formData: FormData,
): Promise<EstadoAbertura> {
  const dentroDoLimite = await registrarTentativa("abrir", 15, 60);
  if (!dentroDoLimite) {
    return {
      estado: "erro",
      mensagem: "Muitas solicitações abertas deste dispositivo. Tente novamente em uma hora.",
    };
  }

  const analise = novoChamadoSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    cpf: formData.get("cpf"),
    telefone: formData.get("telefone") ?? undefined,
    unidade: formData.get("unidade") ?? undefined,
    vinculo: formData.get("vinculo"),
    categoria: formData.get("categoria"),
    subcategoria: formData.get("subcategoria"),
    descricao: formData.get("descricao"),
  });

  if (!analise.success) return { estado: "erro", mensagem: primeiroErro(analise.error) };
  const dados = analise.data;
  const vinculo = dados.vinculo as VinculoSlug;

  const sub = acharSubcategoria(vinculo, dados.categoria, dados.subcategoria);
  if (!sub) return { estado: "erro", mensagem: "Assunto inválido. Recomece a solicitação." };

  // A unidade vem de lista fechada: é ela que sustenta o corte por unidade nos
  // indicadores, então não pode entrar texto livre por outro caminho.
  if (!dados.unidade || !UNIDADES.includes(dados.unidade as (typeof UNIDADES)[number])) {
    return { estado: "erro", mensagem: "Selecione a sua unidade na lista." };
  }

  // Estagiário informa quem o supervisiona: é com essa pessoa que o RH confirma
  // frequência, recesso e ajustes.
  const supervisores = formData
    .getAll("supervisor")
    .map((v) => String(v).trim())
    .filter(Boolean)
    .slice(0, 5);

  if (vinculo === "estagio" && supervisores.length === 0) {
    return { estado: "erro", mensagem: "Informe pelo menos um supervisor responsável." };
  }

  const extras = validarCamposExtras(vinculo, dados.categoria, dados.subcategoria, formData);
  if (!extras.ok) return { estado: "erro", mensagem: extras.erro };

  const anexos = lerAnexos(formData);

  if (sub.anexoObrigatorio && anexos.length === 0) {
    return { estado: "erro", mensagem: "Este assunto exige pelo menos um anexo." };
  }
  const erroAnexo = validarAnexos(anexos);
  if (erroAnexo) return { estado: "erro", mensagem: erroAnexo };

  const assunto = rotuloAssunto(vinculo, dados.categoria, dados.subcategoria);

  let descricao = dados.descricao;
  if (descricao.length < 15) {
    if (!sub.descricaoDispensavel) {
      return {
        estado: "erro",
        mensagem: "Descreva sua solicitação com pelo menos 15 caracteres.",
      };
    }
    if (!descricao) descricao = `Solicitação registrada pelo formulário: ${assunto}.`;
  }

  const supabase = supabaseAdmin();

  const { data: chamado, error } = await supabase
    .from("chamados")
    .insert({
      solicitante_nome: dados.nome,
      solicitante_email: dados.email,
      solicitante_cpf: dados.cpf,
      solicitante_telefone: dados.telefone ?? null,
      unidade: dados.unidade ?? null,
      supervisores: supervisores.length > 0 ? supervisores.join("; ") : null,
      vinculo,
      categoria: dados.categoria,
      subcategoria: dados.subcategoria,
      assunto,
      descricao,
      dados_extras: extras.dados,
    })
    .select("id, protocolo")
    .single();

  if (error || !chamado) {
    console.error("[chamado] falha ao registrar:", error?.message);
    return {
      estado: "erro",
      mensagem: "Não conseguimos registrar sua solicitação agora. Tente novamente em instantes.",
    };
  }

  const { data: mensagem } = await supabase
    .from("chamado_mensagens")
    .insert({
      chamado_id: chamado.id,
      autor_tipo: "colaborador",
      autor_nome: dados.nome,
      corpo: descricao,
    })
    .select("id")
    .single();

  if (anexos.length > 0) {
    await registrarAnexos(chamado.id, anexos, mensagem?.id ?? null);
  }

  await supabase.from("chamado_eventos").insert({
    chamado_id: chamado.id,
    autor_nome: dados.nome,
    descricao: "Chamado aberto pelo colaborador",
  });

  await Promise.all([
    emailChamadoAberto({
      para: dados.email,
      nome: dados.nome,
      protocolo: chamado.protocolo,
      assunto,
    }),
    emailAvisoRh({
      protocolo: chamado.protocolo,
      assunto,
      solicitante: dados.nome,
      vinculo: tituloVinculo(vinculo),
    }),
    limparTentativasAntigas(),
  ]);

  return { estado: "ok", protocolo: chamado.protocolo, email: dados.email };
}

// ---------------------------------------------------------------------------
// Consultar chamado (protocolo + CPF)
// ---------------------------------------------------------------------------

async function carregarChamadoPublico(
  protocolo: string,
  cpf: string,
): Promise<ChamadoPublico | null> {
  const supabase = supabaseAdmin();

  const { data: chamado } = await supabase
    .from("chamados")
    .select(
      "id, protocolo, solicitante_nome, solicitante_cpf, vinculo, categoria, subcategoria, assunto, descricao, dados_extras, status, criado_em, atualizado_em",
    )
    .eq("protocolo", protocolo.toUpperCase())
    .maybeSingle();

  if (!chamado || chamado.solicitante_cpf !== cpf) return null;

  const [{ data: mensagens }, { data: internas }, { data: anexos }, { data: etapas }] =
    await Promise.all([
    supabase
      .from("chamado_mensagens")
      .select("id, autor_tipo, autor_nome, corpo, criado_em")
      .eq("chamado_id", chamado.id)
      .eq("interna", false) // notas internas do RH nunca saem daqui
      .order("criado_em", { ascending: true }),
    supabase
      .from("chamado_mensagens")
      .select("id")
      .eq("chamado_id", chamado.id)
      .eq("interna", true),
    supabase
      .from("chamado_anexos")
      .select("*")
      .eq("chamado_id", chamado.id)
      .order("criado_em", { ascending: true }),
    supabase
      .from("chamado_eventos")
      .select("id, descricao, criado_em")
      .eq("chamado_id", chamado.id)
      .eq("publico", true) // movimentações de bastidor ficam só para o RH
      .order("criado_em", { ascending: true }),
  ]);

  const { solicitante_cpf: _cpf, id: _id, ...publico } = chamado;

  // Arquivo preso a uma nota interna acompanha o sigilo dela.
  const idsInternas = new Set((internas ?? []).map((m) => m.id));
  const anexosVisiveis = ((anexos ?? []) as Anexo[]).filter(
    (anexo) => !anexo.mensagem_id || !idsInternas.has(anexo.mensagem_id),
  );

  return {
    chamado: publico as ChamadoPublico["chamado"],
    mensagens: (mensagens ?? []) as ChamadoPublico["mensagens"],
    anexos: await assinarAnexos(anexosVisiveis),
    etapas: (etapas ?? []) as ChamadoPublico["etapas"],
  };
}

export async function consultarChamado(
  _anterior: EstadoConsulta,
  formData: FormData,
): Promise<EstadoConsulta> {
  const dentroDoLimite = await registrarTentativa("consulta", 12, 15);
  if (!dentroDoLimite) {
    return {
      estado: "erro",
      mensagem: "Muitas tentativas seguidas. Aguarde 15 minutos e tente de novo.",
    };
  }

  const analise = consultaSchema.safeParse({
    protocolo: formData.get("protocolo"),
    cpf: formData.get("cpf"),
  });
  if (!analise.success) return { estado: "erro", mensagem: primeiroErro(analise.error) };

  const { protocolo, cpf } = analise.data;
  const dados = await carregarChamadoPublico(protocolo, cpf);

  if (!dados) {
    return {
      estado: "erro",
      mensagem: "Não encontramos um chamado com esse protocolo e CPF. Confira os dados.",
    };
  }

  await limparTentativasAntigas();
  return { estado: "ok", dados, protocolo: dados.chamado.protocolo, cpf };
}

// ---------------------------------------------------------------------------
// Colaborador responde o próprio chamado
// ---------------------------------------------------------------------------

export async function responderComoColaborador(
  _anterior: EstadoConsulta,
  formData: FormData,
): Promise<EstadoConsulta> {
  const analise = respostaColaboradorSchema.safeParse({
    protocolo: formData.get("protocolo"),
    cpf: formData.get("cpf"),
    mensagem: formData.get("mensagem"),
  });
  if (!analise.success) return { estado: "erro", mensagem: primeiroErro(analise.error) };

  const { protocolo, cpf, mensagem } = analise.data;
  const supabase = supabaseAdmin();

  const { data: chamado } = await supabase
    .from("chamados")
    .select("id, protocolo, solicitante_nome, solicitante_cpf, status")
    .eq("protocolo", protocolo.toUpperCase())
    .maybeSingle();

  if (!chamado || chamado.solicitante_cpf !== cpf) {
    return { estado: "erro", mensagem: "Chamado não encontrado." };
  }
  if (chamado.status === "cancelado") {
    return { estado: "erro", mensagem: "Este chamado foi cancelado e não aceita novas mensagens." };
  }

  const anexos = lerAnexos(formData);
  const erroAnexo = validarAnexos(anexos);
  if (erroAnexo) return { estado: "erro", mensagem: erroAnexo };

  const { data: novaMensagem } = await supabase
    .from("chamado_mensagens")
    .insert({
      chamado_id: chamado.id,
      autor_tipo: "colaborador",
      autor_nome: chamado.solicitante_nome,
      corpo: mensagem,
    })
    .select("id")
    .single();

  if (anexos.length > 0) {
    await registrarAnexos(chamado.id, anexos, novaMensagem?.id ?? null);
  }

  // Responder reabre o chamado: nada de assunto encerrado por engano.
  const novoStatus =
    chamado.status === "resolvido" || chamado.status === "aguardando_colaborador"
      ? "aberto"
      : chamado.status;

  await supabase.from("chamados").update({ status: novoStatus }).eq("id", chamado.id);

  if (novoStatus !== chamado.status) {
    await supabase.from("chamado_eventos").insert({
      chamado_id: chamado.id,
      autor_nome: chamado.solicitante_nome,
      descricao: "Chamado reaberto pela resposta do colaborador",
    });
  }

  const dados = await carregarChamadoPublico(chamado.protocolo, cpf);
  if (!dados) return { estado: "erro", mensagem: "Chamado não encontrado." };

  return { estado: "ok", dados, protocolo: chamado.protocolo, cpf };
}
