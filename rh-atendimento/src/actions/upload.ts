"use server";

import { randomUUID } from "node:crypto";
import { MAX_ANEXOS, TAMANHO_MAX_ANEXO, TIPOS_ANEXO_ACEITOS } from "@/lib/dominio";
import { nomeArquivoSeguro } from "@/lib/format";
import { registrarTentativa } from "@/lib/limite";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Anexos não passam pelo servidor do site.
 *
 * A Vercel corta requisições acima de ~4,5 MB, e uma foto de atestado tirada
 * no celular passa disso com facilidade - a requisição morria antes de chegar
 * no nosso código. Aqui o servidor apenas autoriza o envio: devolve um
 * endereço temporário e o navegador manda o arquivo direto para o Supabase.
 */

export type PreparoAnexo =
  | { ok: true; caminho: string; token: string }
  | { ok: false; erro: string };

export async function prepararEnvioDeAnexo(pedido: {
  nome: string;
  tipo: string;
  tamanho: number;
}): Promise<PreparoAnexo> {
  const dentroDoLimite = await registrarTentativa("anexo", MAX_ANEXOS * 12, 60);
  if (!dentroDoLimite) {
    return { ok: false, erro: "Muitos arquivos enviados deste dispositivo. Tente mais tarde." };
  }

  if (pedido.tamanho > TAMANHO_MAX_ANEXO) {
    return {
      ok: false,
      erro: `"${pedido.nome}" passa de 8 MB. Tire a foto em qualidade menor ou envie em PDF.`,
    };
  }

  if (pedido.tipo && !TIPOS_ANEXO_ACEITOS.includes(pedido.tipo)) {
    return { ok: false, erro: `"${pedido.nome}" não é um formato aceito. Envie PDF, JPG ou PNG.` };
  }

  // Fica em "rascunho" até a solicitação ser registrada; só então o arquivo é
  // movido para a pasta do chamado.
  const caminho = `rascunho/${randomUUID()}-${nomeArquivoSeguro(pedido.nome)}`;

  const { data, error } = await supabaseAdmin()
    .storage.from("anexos")
    .createSignedUploadUrl(caminho);

  if (error || !data) {
    console.error("[anexo] falha ao preparar envio:", error?.message);
    return { ok: false, erro: "Não conseguimos preparar o envio do anexo. Tente novamente." };
  }

  return { ok: true, caminho: data.path, token: data.token };
}
