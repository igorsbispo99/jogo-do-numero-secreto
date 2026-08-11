"use server";

import { acharSubcategoria, rotuloAssunto, tituloVinculo, type VinculoSlug } from "@/lib/catalogo";
import { MAX_ANEXOS, TAMANHO_MAX_ANEXO, TIPOS_ANEXO_ACEITOS } from "@/lib/dominio";
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

const PASTA_RASCUNHO = "rascunho/";

type AnexoEnviado = { caminho: string; nome: string; tipo: string; tamanho: number };

/**
 * O navegador já subiu os arquivos direto para o Supabase (veja
 * actions/upload.ts). O formulário traz apenas os endereços deles.
 */
function lerAnexos(formData: FormData): AnexoEnviado[] {
  const caminhos = formData.getAll("anexo_caminho").map(String).filter(Boolean);
  const nomes = formData.getAll("anexo_nome").map(String);
  const tipos = formData.getAll("anexo_tipo").map(String);
  const tamanhos = formData.getAll("anexo_tamanho").map((v) => Number(v) || 0);

  return caminhos.slice(0, MAX_ANEXOS).map((caminho, i) => ({
    caminho,
    nome: (nomes[i] ?? "anexo").slice(0, 200),
    tipo: tipos[i] ?? "",
    tamanho: tamanhos[i] ?? 0,
  }));
}

function validarAnexos(anexos: AnexoEnviado[]): string | null {
  if (anexos.length > MAX_ANEXOS) return `Envie no máximo ${MAX_ANEXOS} arquivos.`;
  for (const anexo of anexos) {
    // Só aceitamos arquivos recém-enviados, nunca um caminho digitado à mão.
    if (!anexo.caminho.startsWith(PASTA_RASCUNHO)) {
      return "Anexo inválido. Selecione o arquivo novamente.";
    }
    if (anexo.tamanho > TAMANHO_MAX_ANEXO) {
      return `"${anexo.nome}" passa de 8 MB. Reduza a qualidade da foto e tente de novo.`;
    }
    if (anexo.tipo && !TIPOS_ANEXO_ACEITOS.includes(anexo.tipo)) {
      return `"${anexo.nome}" não é um formato aceito. Envie PDF, JPG ou PNG.`;
    }
  }
  return null;
}

/** Move os arquivos do rascunho para a pasta do chamado e registra cada um. */
async function registrarAnexos(
  chamadoId: string,
  anexos: AnexoEnviado[],
  mensagemId: string | null,
): Promise<void> {
  const supabase = supabaseAdmin();

  for (const anexo of anexos) {
    const destino = `${chamadoId}/${anexo.caminho.slice(PASTA_RASCUNHO.length)}`;
    const { error } = await supabase.storage.from("anexos").move(anexo.caminho, destino);

    if (error) console.error("[anexo] falha ao mover:", error.message);

    await supabase.from("chamado_anexos").insert({
      chamado_id: chamadoId,
      mensagem_id: mensagemId,
      caminho: error ? anexo.caminho : destino,
      nome_arquivo: anexo.nome,
      tipo_mime: anexo.tipo || null,
      tamanho_bytes: anexo.tamanho || null,
    });
  }
}

async function assinarAnexos(anexos: Anexo[]): Promise<AnexoComLink[]> {
  if (anexos.length === 0) return [];
  const supabase = supabaseAdmin();

  return Promise.all(
    anexos.map(async (anexo) => {
      if (anexo.removido_em) return { ...anexo, url: null };
      const { data } = await supabase.storage
        .from("anexos")
        .createSignedUrl(anexo.caminho, 60 * 30, { download: anexo.nome_arquivo });
      return { ...anexo, url: data?.signedUrl ?? null };
    }),
  );
}

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

  const [{ data: mensagens }, { data: anexos }, { data: etapas }] = await Promise.all([
    supabase
      .from("chamado_mensagens")
      .select("id, autor_tipo, autor_nome, corpo, criado_em")
      .eq("chamado_id", chamado.id)
      .eq("interna", false) // notas internas do RH nunca saem daqui
      .order("criado_em", { ascending: true }),
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

  return {
    chamado: publico as ChamadoPublico["chamado"],
    mensagens: (mensagens ?? []) as ChamadoPublico["mensagens"],
    anexos: await assinarAnexos((anexos ?? []) as Anexo[]),
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
