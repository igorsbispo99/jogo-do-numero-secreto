import "server-only";
import { Resend } from "resend";

/**
 * Envio de e-mail pelo Resend (plano gratuito: 3.000 e-mails/mês).
 * Sem RESEND_API_KEY configurada o sistema continua funcionando normalmente -
 * apenas registra no log em vez de enviar.
 */

type Envio = {
  para: string | string[];
  assunto: string;
  titulo: string;
  linhas: string[];
  botao?: { texto: string; url: string };
  rodape?: string;
};

function urlBase(): string {
  return (
    process.env.NEXT_PUBLIC_URL_BASE ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function montarHtml(envio: Envio): string {
  const corpo = envio.linhas
    .map((l) => `<p style="margin:0 0 12px;line-height:1.6;color:#334155">${l}</p>`)
    .join("");

  const botao = envio.botao
    ? `<p style="margin:24px 0"><a href="${escapar(envio.botao.url)}"
         style="background:#06665e;color:#fff;padding:12px 20px;border-radius:8px;
                text-decoration:none;font-weight:600;display:inline-block">
         ${escapar(envio.botao.texto)}</a></p>`
    : "";

  // Faixa com as cinco cores da marca, no topo do e-mail.
  const faixa = ["#26a3d0", "#09a497", "#f9a50f", "#ec562a", "#901845"]
    .map(
      (cor) =>
        `<td width="20%" height="5" style="background:${cor};font-size:0;line-height:0">&nbsp;</td>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f1f5f9;padding:24px;
  font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;
               border:1px solid #e2e8f0">
        <tr>${faixa}</tr>
        <tr><td colspan="5" style="padding:32px">
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;
            text-transform:uppercase;color:#06665e;font-weight:700">Grupo TEA · RH</p>
          <h1 style="margin:0 0 16px;font-size:20px;color:#16357d">${escapar(envio.titulo)}</h1>
          ${corpo}
          ${botao}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
          <p style="margin:0 0 6px;font-size:12px;color:#16357d;font-weight:600">
            TEA Clínica e Desenvolvimento LTDA · Conectar • Acolher • Desenvolver
          </p>
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5">
            ${escapar(envio.rodape ?? "Este e-mail é automático, não responda por aqui. Use a central de atendimento para falar com o RH.")}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function enviar(envio: Envio): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const remetente = process.env.EMAIL_REMETENTE ?? "RH Grupo TEA <onboarding@resend.dev>";

  if (!apiKey) {
    console.info("[email] RESEND_API_KEY ausente - envio ignorado:", envio.assunto, envio.para);
    return;
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: remetente,
      to: envio.para,
      subject: envio.assunto,
      html: montarHtml(envio),
    });
  } catch (erro) {
    // E-mail nunca pode derrubar a abertura do chamado.
    console.error("[email] falha no envio:", erro);
  }
}

const negrito = (t: string) => `<strong>${escapar(t)}</strong>`;

export async function emailChamadoAberto(dados: {
  para: string;
  nome: string;
  protocolo: string;
  assunto: string;
}) {
  const link = `${urlBase()}/consulta?protocolo=${encodeURIComponent(dados.protocolo)}`;
  await enviar({
    para: dados.para,
    assunto: `[${dados.protocolo}] Recebemos sua solicitação`,
    titulo: "Recebemos sua solicitação",
    linhas: [
      `Olá, ${escapar(dados.nome.split(" ")[0])}!`,
      `Sua solicitação foi registrada com o protocolo ${negrito(dados.protocolo)}.`,
      `Assunto: ${escapar(dados.assunto)}.`,
      "Guarde este número: com ele e seu CPF você acompanha o andamento e responde ao RH a qualquer momento.",
    ],
    botao: { texto: "Acompanhar chamado", url: link },
  });
}

export async function emailNovaResposta(dados: {
  para: string;
  nome: string;
  protocolo: string;
  autor: string;
  trecho: string;
}) {
  const link = `${urlBase()}/consulta?protocolo=${encodeURIComponent(dados.protocolo)}`;
  await enviar({
    para: dados.para,
    assunto: `[${dados.protocolo}] O RH respondeu seu chamado`,
    titulo: "Você tem uma resposta do RH",
    linhas: [
      `Olá, ${escapar(dados.nome.split(" ")[0])}!`,
      `${escapar(dados.autor)} respondeu o chamado ${negrito(dados.protocolo)}:`,
      `<em style="color:#475569">${escapar(dados.trecho)}</em>`,
      "Abra o chamado para ler a resposta completa e responder.",
    ],
    botao: { texto: "Ver resposta", url: link },
  });
}

export async function emailChamadoResolvido(dados: {
  para: string;
  nome: string;
  protocolo: string;
}) {
  const link = `${urlBase()}/consulta?protocolo=${encodeURIComponent(dados.protocolo)}`;
  await enviar({
    para: dados.para,
    assunto: `[${dados.protocolo}] Chamado resolvido`,
    titulo: "Seu chamado foi resolvido",
    linhas: [
      `Olá, ${escapar(dados.nome.split(" ")[0])}!`,
      `O chamado ${negrito(dados.protocolo)} foi marcado como resolvido pelo RH.`,
      "Se o assunto não foi totalmente resolvido, responda no próprio chamado que ele volta para a fila.",
    ],
    botao: { texto: "Ver chamado", url: link },
  });
}

export async function emailAvisoRh(dados: {
  protocolo: string;
  assunto: string;
  solicitante: string;
  vinculo: string;
}) {
  const destino = process.env.EMAIL_AVISO_RH;
  if (!destino) return;

  const link = `${urlBase()}/rh`;
  await enviar({
    para: destino.split(",").map((e) => e.trim()),
    assunto: `[${dados.protocolo}] Novo chamado · ${dados.assunto}`,
    titulo: "Novo chamado na fila",
    linhas: [
      `Protocolo: ${negrito(dados.protocolo)}`,
      `Solicitante: ${escapar(dados.solicitante)} (${escapar(dados.vinculo)})`,
      `Assunto: ${escapar(dados.assunto)}`,
    ],
    botao: { texto: "Abrir painel do RH", url: link },
    rodape: "Aviso interno da central de atendimento do RH.",
  });
}
