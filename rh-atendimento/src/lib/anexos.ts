import "server-only";
import { MAX_ANEXOS, TAMANHO_MAX_ANEXO, TIPOS_ANEXO_ACEITOS } from "@/lib/dominio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Anexo, AnexoComLink } from "@/lib/tipos";

/**
 * Tratamento dos anexos, compartilhado entre o colaborador e o RH.
 *
 * Os arquivos sobem do navegador direto para o Supabase (veja
 * actions/upload.ts); daqui para a frente só circulam os endereços deles.
 */

export const PASTA_RASCUNHO = "rascunho/";

export type AnexoEnviado = { caminho: string; nome: string; tipo: string; tamanho: number };

export function lerAnexos(formData: FormData): AnexoEnviado[] {
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

export function validarAnexos(anexos: AnexoEnviado[]): string | null {
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
export async function registrarAnexos(
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

/** Gera links temporários de download; arquivo já apagado fica sem link. */
export async function assinarAnexos(anexos: Anexo[]): Promise<AnexoComLink[]> {
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
