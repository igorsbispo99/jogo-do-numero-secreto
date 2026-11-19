import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";

/**
 * Envio de e-mail por um destes caminhos, nesta ordem:
 *
 * 1. SMTP de uma caixa de e-mail (SMTP_USUARIO + SMTP_SENHA). Serve para
 *    enviar por uma conta Gmail com senha de app, sem configurar DNS. O
 *    servidor padrão é o do Gmail; outro servidor vai em SMTP_HOST/SMTP_PORTA.
 * 2. Resend (RESEND_API_KEY), que exige o domínio do remetente validado.
 *
 * Sem nenhum dos dois o sistema continua funcionando normalmente - apenas
 * registra no log em vez de enviar.
 */

type Envio = {
  para: string | string[];
  assunto: string;
  titulo: string;
  linhas: string[];
  botao?: { texto: string; url: string };
  rodape?: string;
  /** Bloco HTML pronto (tabelas dos resumos), inserido depois das linhas. */
  html?: string;
};

export function urlBase(): string {
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
          ${envio.html ?? ""}
          ${botao}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
          <p style="margin:0 0 6px;font-size:12px;color:#16357d;font-weight:600">
            TEA Clínica e Desenvolvimento LTDA · Conectar • Acolher • Desenvolver
          </p>
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5">
            ${escapar(envio.rodape ?? "Este e-mail é automático, não responda por aqui. Use a Central de Atendimento para falar com o RH.")}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

let transporteSmtp: Transporter | null = null;

function smtp(): Transporter | null {
  const usuario = process.env.SMTP_USUARIO;
  const senha = process.env.SMTP_SENHA;
  if (!usuario || !senha) return null;
  if (transporteSmtp) return transporteSmtp;

  const porta = Number(process.env.SMTP_PORTA ?? 465);
  transporteSmtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: porta,
    secure: porta === 465,
    auth: { user: usuario, pass: senha },
  });
  return transporteSmtp;
}

async function enviarPorSmtp(transporte: Transporter, envio: Envio): Promise<boolean> {
  // O Gmail só aceita como remetente a própria conta: o nome de exibição é o que muda.
  const nome = process.env.SMTP_NOME_REMETENTE ?? "RH Grupo TEA";
  try {
    await transporte.sendMail({
      from: { name: nome, address: process.env.SMTP_USUARIO! },
      to: envio.para,
      subject: envio.assunto,
      html: montarHtml(envio),
    });
    return true;
  } catch (erro) {
    // E-mail nunca pode derrubar a abertura do chamado.
    console.error("[email] falha no envio por SMTP:", erro instanceof Error ? erro.message : erro);
    return false;
  }
}

async function enviar(envio: Envio): Promise<boolean> {
  const transporte = smtp();
  if (transporte) return enviarPorSmtp(transporte, envio);

  const apiKey = process.env.RESEND_API_KEY;
  const remetente = process.env.EMAIL_REMETENTE ?? "RH Grupo TEA <onboarding@resend.dev>";

  if (!apiKey) {
    console.info("[email] sem SMTP nem RESEND_API_KEY - envio ignorado:", envio.assunto);
    return false;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: remetente,
      to: envio.para,
      subject: envio.assunto,
      html: montarHtml(envio),
    });
    if (error) {
      console.error("[email] falha no envio:", error.message);
      return false;
    }
    return true;
  } catch (erro) {
    // E-mail nunca pode derrubar a abertura do chamado.
    console.error("[email] falha no envio:", erro);
    return false;
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
      `Sua solicitação foi registrada com o protocolo ${negrito(dados.protocolo)} e já chegou ao time responsável.`,
      `Assunto: ${escapar(dados.assunto)}.`,
      "Guarde este número: com ele e seu CPF você acompanha cada etapa e responde ao RH a qualquer momento.",
      "Conte com a gente! 💙",
    ],
    botao: { texto: "Acompanhar solicitação", url: link },
  });
}

const avisoDeAnexos = (quantidade: number | undefined) =>
  quantidade
    ? [`A resposta veio com ${quantidade} anexo${quantidade === 1 ? "" : "s"} para você baixar.`]
    : [];

export async function emailNovaResposta(dados: {
  para: string;
  nome: string;
  protocolo: string;
  autor: string;
  trecho: string;
  anexos?: number;
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
      ...avisoDeAnexos(dados.anexos),
      "Abra a solicitação para ler a resposta completa e responder.",
    ],
    botao: { texto: "Ver resposta", url: link },
  });
}

export async function emailChamadoResolvido(dados: {
  para: string;
  nome: string;
  protocolo: string;
  /** Resposta que encerrou o atendimento, quando houver. */
  autor?: string;
  trecho?: string;
  anexos?: number;
}) {
  const link = `${urlBase()}/consulta?protocolo=${encodeURIComponent(dados.protocolo)}`;

  const respostaFinal =
    dados.trecho && dados.autor
      ? [
          `${escapar(dados.autor)} respondeu:`,
          `<em style="color:#475569">${escapar(dados.trecho)}</em>`,
        ]
      : [];

  await enviar({
    para: dados.para,
    assunto: `[${dados.protocolo}] Solicitação resolvida`,
    titulo: "Sua solicitação foi resolvida",
    linhas: [
      `Olá, ${escapar(dados.nome.split(" ")[0])}!`,
      `A solicitação ${negrito(dados.protocolo)} foi resolvida pelo RH.`,
      ...respostaFinal,
      ...avisoDeAnexos(dados.anexos),
      "Se o assunto não foi totalmente resolvido, é só responder por lá que ele volta para a fila.",
      "Conte com a gente! 💙",
    ],
    botao: { texto: "Ver solicitação", url: link },
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
    rodape: "Aviso interno da Central de Atendimento do RH.",
  });
}

// ---------------------------------------------------------------------------
// Avisos internos de SLA e resumos diários
//
// Só números e links: nenhum nome de colaborador, relato ou dado pessoal sai
// por e-mail. Os detalhes ficam no portal, protegidos pelo login.
// ---------------------------------------------------------------------------

export type ItemResumo = {
  rotulo: string;
  valor: number | string;
  /** Caminho no portal (ex.: /rh?prazo=vencidos). Vira link no número. */
  href?: string;
  destaque?: "vermelho" | "ambar" | "neutro";
};

const CORES_DESTAQUE = {
  vermelho: { fundo: "#f7eff2", texto: "#901845" },
  ambar: { fundo: "#fff9ee", texto: "#9a6609" },
  neutro: { fundo: "#f8fafc", texto: "#0f172a" },
};

function tabelaResumo(titulo: string | null, itens: ItemResumo[]): string {
  const linhas = itens
    .map((item) => {
      const cor = CORES_DESTAQUE[item.destaque ?? "neutro"];
      const valor = escapar(String(item.valor));
      const numero = item.href
        ? `<a href="${escapar(`${urlBase()}${item.href}`)}" style="color:${cor.texto};text-decoration:none">${valor}</a>`
        : valor;
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:14px">${escapar(item.rotulo)}</td>
        <td align="right" style="padding:10px 12px;border-bottom:1px solid #e2e8f0;background:${cor.fundo};font-size:18px;font-weight:700;color:${cor.texto};white-space:nowrap">${numero}</td>
      </tr>`;
    })
    .join("");
  const cabecalho = titulo
    ? `<p style="margin:20px 0 8px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b">${escapar(titulo)}</p>`
    : "";
  return `${cabecalho}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;overflow:hidden">${linhas}</table>`;
}

const RODAPE_INTERNO =
  "Aviso interno da Central de Atendimento do RH. Os números levam direto para a lista no portal.";

export async function emailChamadoCritico(dados: {
  para: string[];
  protocolo: string;
  assunto: string;
  vinculo: string;
  motivo: string;
  primeiraRespostaAte: string;
  chamadoId: string;
  origem: "previa" | "revisao";
}): Promise<boolean> {
  if (dados.para.length === 0) return false;
  return enviar({
    para: dados.para,
    assunto: `[${dados.protocolo}] Chamado Crítico · escalar agora`,
    titulo: "Chamado Crítico na fila",
    linhas: [
      dados.origem === "previa"
        ? `A prévia de SLA classificou o chamado ${negrito(dados.protocolo)} como ${negrito("Crítica")}. Escale agora, sem esperar a validação da triagem.`
        : `O chamado ${negrito(dados.protocolo)} foi reclassificado como ${negrito("Crítica")} na triagem.`,
      `Assunto: ${escapar(dados.assunto)} (${escapar(dados.vinculo)}).`,
      `Motivo: ${escapar(dados.motivo)}`,
      `1ª resposta até ${negrito(dados.primeiraRespostaAte)}.`,
    ],
    botao: { texto: "Abrir o chamado", url: `${urlBase()}/rh/chamados/${dados.chamadoId}` },
    rodape: RODAPE_INTERNO,
  });
}

export async function emailResumoPessoal(dados: {
  para: string;
  nome: string;
  dia: string;
  itens: ItemResumo[];
}): Promise<boolean> {
  return enviar({
    para: dados.para,
    assunto: `Seus chamados hoje · ${dados.dia}`,
    titulo: "Seus chamados hoje",
    linhas: [`Bom dia, ${escapar(dados.nome.split(" ")[0])}! Este é o resumo dos chamados atribuídos a você.`],
    html: tabelaResumo(null, dados.itens),
    botao: { texto: "Abrir meus chamados", url: `${urlBase()}/rh?responsavel=meus&ordem=prazo` },
    rodape: `${RODAPE_INTERNO} Para não receber este resumo, desligue em Minha conta.`,
  });
}

export async function emailResumoGestao(dados: {
  para: string[];
  dia: string;
  periodo: string;
  blocos: { titulo: string; itens: ItemResumo[] }[];
}): Promise<boolean> {
  return enviar({
    para: dados.para,
    assunto: `Resumo da Central do RH · ${dados.dia}`,
    titulo: "Resumo da Central do RH",
    linhas: [`Movimento de ${escapar(dados.periodo)} e situação da fila agora.`],
    html: dados.blocos.map((b) => tabelaResumo(b.titulo, b.itens)).join(""),
    botao: { texto: "Abrir os indicadores", url: `${urlBase()}/rh/indicadores` },
    rodape: RODAPE_INTERNO,
  });
}

export async function emailResumoTriagem(dados: {
  para: string[];
  dia: string;
  itens: ItemResumo[];
}): Promise<boolean> {
  return enviar({
    para: dados.para,
    assunto: `Triagem do dia · ${dados.dia}`,
    titulo: "Pendências de triagem",
    linhas: ["Chamados que precisam de classificação, responsável ou 1ª resposta."],
    html: tabelaResumo(null, dados.itens),
    botao: { texto: "Abrir a fila", url: `${urlBase()}/rh?ordem=prazo` },
    rodape: RODAPE_INTERNO,
  });
}

export async function emailSenhaAlterada(dados: {
  para: string;
  nome: string;
  quando: string;
  como: "troca" | "recuperacao";
}): Promise<boolean> {
  return enviar({
    para: dados.para,
    assunto: "Sua senha do Painel do RH foi alterada",
    titulo: "Sua senha foi alterada",
    linhas: [
      `Olá, ${escapar(dados.nome.split(" ")[0])}!`,
      dados.como === "troca"
        ? `A senha do seu acesso ao Painel do RH foi alterada em ${negrito(dados.quando)}, pela tela Minha conta.`
        : `A senha do seu acesso ao Painel do RH foi redefinida em ${negrito(dados.quando)}, pelo link de recuperação.`,
      "Por segurança, os outros computadores e celulares em que você estava conectado foram desconectados.",
      "Se não foi você, avise agora o responsável pelo portal.",
    ],
    rodape: "Aviso de segurança automático. Nunca enviamos senhas por e-mail.",
  });
}
