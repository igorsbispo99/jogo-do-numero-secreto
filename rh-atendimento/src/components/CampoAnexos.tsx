"use client";

import { useState } from "react";
import { prepararEnvioDeAnexo } from "@/actions/upload";
import { MAX_ANEXOS } from "@/lib/dominio";
import { formatarBytes } from "@/lib/format";
import { supabaseNavegador } from "@/lib/supabase/browser";

type Enviado = { caminho: string; nome: string; tipo: string; tamanho: number };

/**
 * Campo de anexos que envia cada arquivo direto para o Supabase assim que ele
 * é escolhido. Quando o formulário é enviado, só viajam os endereços dos
 * arquivos já guardados - nunca o conteúdo deles.
 */
export function CampoAnexos({
  id,
  obrigatorio = false,
  ajuda,
}: {
  id: string;
  obrigatorio?: boolean;
  ajuda?: string;
}) {
  const [enviados, setEnviados] = useState<Enviado[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEscolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const escolhidos = Array.from(evento.target.files ?? []);
    evento.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (escolhidos.length === 0) return;

    if (enviados.length + escolhidos.length > MAX_ANEXOS) {
      setErro(`Você pode anexar no máximo ${MAX_ANEXOS} arquivos.`);
      return;
    }

    setEnviando(true);
    setErro(null);
    const supabase = supabaseNavegador();

    for (const arquivo of escolhidos) {
      const preparo = await prepararEnvioDeAnexo({
        nome: arquivo.name,
        tipo: arquivo.type,
        tamanho: arquivo.size,
      });

      if (!preparo.ok) {
        setErro(preparo.erro);
        continue;
      }

      const { error } = await supabase.storage
        .from("anexos")
        .uploadToSignedUrl(preparo.caminho, preparo.token, arquivo, {
          contentType: arquivo.type || undefined,
        });

      if (error) {
        console.error("[anexo] falha no envio:", error.message);
        setErro(`Não conseguimos enviar "${arquivo.name}". Tente novamente.`);
        continue;
      }

      setEnviados((atuais) => [
        ...atuais,
        {
          caminho: preparo.caminho,
          nome: arquivo.name,
          tipo: arquivo.type,
          tamanho: arquivo.size,
        },
      ]);
    }

    setEnviando(false);
  }

  function remover(caminho: string) {
    setEnviados((atuais) => atuais.filter((a) => a.caminho !== caminho));
  }

  return (
    <div>
      {enviados.map((anexo) => (
        <div key={anexo.caminho}>
          <input type="hidden" name="anexo_caminho" value={anexo.caminho} />
          <input type="hidden" name="anexo_nome" value={anexo.nome} />
          <input type="hidden" name="anexo_tipo" value={anexo.tipo} />
          <input type="hidden" name="anexo_tamanho" value={anexo.tamanho} />
        </div>
      ))}

      <input
        id={id}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
        onChange={aoEscolher}
        disabled={enviando || enviados.length >= MAX_ANEXOS}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-tea-turquesa-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-tea-turquesa-800"
      />

      <p className="mt-1 text-xs text-slate-500">
        {ajuda ?? "PDF, JPG ou PNG."} Até {MAX_ANEXOS} arquivos, 8 MB cada.
      </p>

      {enviando && (
        <p className="mt-2 text-xs font-semibold text-tea-turquesa-700">Enviando arquivo...</p>
      )}

      {enviados.length > 0 && (
        <ul className="mt-3 space-y-2">
          {enviados.map((anexo) => (
            <li
              key={anexo.caminho}
              className="flex items-center justify-between gap-3 rounded-lg bg-tea-turquesa-50 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-slate-700">
                ✓ {anexo.nome}
                <span className="ml-2 text-xs text-slate-500">{formatarBytes(anexo.tamanho)}</span>
              </span>
              <button
                type="button"
                onClick={() => remover(anexo.caminho)}
                className="shrink-0 text-xs font-semibold text-slate-500 hover:text-tea-vinho-600"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}

      {erro && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-700">
          {erro}
        </p>
      )}

      {obrigatorio && enviados.length === 0 && (
        <p className="mt-2 text-xs font-medium text-tea-laranja-700">
          Este assunto exige pelo menos um anexo.
        </p>
      )}
    </div>
  );
}
