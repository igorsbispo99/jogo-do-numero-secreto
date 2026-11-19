export function apenasDigitos(valor: string): string {
  return (valor || "").replace(/\D+/g, "");
}

/** Validação de CPF pelos dígitos verificadores. */
export function cpfValido(entrada: string): boolean {
  const cpf = apenasDigitos(entrada);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return (
    digito(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    digito(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

export function mascararCpf(entrada: string): string {
  const cpf = apenasDigitos(entrada).slice(0, 11);
  return cpf
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** Mostra apenas os 3 dígitos do meio: 123.***.789-** vira ***.456.***-** */
export function cpfOfuscado(entrada: string): string {
  const cpf = apenasDigitos(entrada);
  if (cpf.length !== 11) return "***";
  return `***.${cpf.slice(3, 6)}.***-**`;
}

const FUSO = "America/Sao_Paulo";

export function formatarDataHora(valor: string | Date | null | undefined): string {
  if (!valor) return "-";
  const data = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(data.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: FUSO,
  }).format(data);
}

export function formatarData(valor: string | Date | null | undefined): string {
  if (!valor) return "-";
  const data = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(data.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: FUSO }).format(data);
}

export function tempoRelativo(valor: string | Date): string {
  const data = typeof valor === "string" ? new Date(valor) : valor;
  const diffMs = Date.now() - data.getTime();
  const minutos = Math.round(diffMs / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.round(horas / 24);
  if (dias < 30) return `há ${dias}d`;
  return formatarData(data);
}

export function formatarBytes(bytes: number | null | undefined): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function iniciais(nome: string): string {
  const partes = (nome || "?").trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "?";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

/** Remove acentos e caracteres problemáticos de nomes de arquivo. */
export function nomeArquivoSeguro(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
}

/** Prazo de SLA: "qui., 19/11 às 18:00", sempre no horário de Brasília. */
export function formatarPrazo(valor: string | Date | null | undefined): string {
  if (!valor) return "-";
  const data = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(data.getTime())) return "-";
  const partes = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO,
  }).formatToParts(data);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${parte("weekday")} ${parte("day")}/${parte("month")} às ${parte("hour")}:${parte("minute")}`;
}

/** Tempo até (ou desde) um prazo: "faltam 2h 10min", "vencido há 30min". */
export function tempoAtePrazo(valor: string | Date, agora = new Date()): string {
  const data = typeof valor === "string" ? new Date(valor) : valor;
  const diff = data.getTime() - agora.getTime();
  const min = Math.round(Math.abs(diff) / 60_000);
  const dias = Math.floor(min / 1440);
  const horas = Math.floor((min % 1440) / 60);
  const minutos = min % 60;
  const partes: string[] = [];
  if (dias) partes.push(`${dias} ${dias === 1 ? "dia" : "dias"}`);
  if (horas) partes.push(`${horas}h`);
  if (!dias && (minutos || !horas)) partes.push(`${minutos}min`);
  return diff >= 0 ? `faltam ${partes.join(" ")}` : `vencido há ${partes.join(" ")}`;
}
