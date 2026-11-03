export type FormatoEtiqueta = "termica" | "a4";

const PADROES_CODE128 = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232", "2331112",
] as const;

export function codigoEtiqueta(codigo: number) {
  if (!Number.isSafeInteger(codigo) || codigo < 1 || codigo > 99999)
    throw new Error("Código inválido para etiqueta.");
  return String(codigo).padStart(5, "0");
}

export function barrasCode128B(codigo: string) {
  if (!/^[0-9]{5}$/.test(codigo)) throw new Error("A etiqueta exige código de cinco dígitos.");
  const dados = [...codigo].map((caractere) => caractere.charCodeAt(0) - 32);
  const checksum = (104 + dados.reduce((soma, valor, indice) => soma + valor * (indice + 1), 0)) % 103;
  const simbolos = [104, ...dados, checksum, 106];
  let x = 10;
  const barras: Array<{ x: number; largura: number }> = [];
  for (const simbolo of simbolos) {
    const padrao = PADROES_CODE128[simbolo];
    if (!padrao) throw new Error("Não foi possível codificar a etiqueta.");
    for (let indice = 0; indice < padrao.length; indice++) {
      const largura = Number(padrao[indice]);
      if (indice % 2 === 0) barras.push({ x, largura });
      x += largura;
    }
  }
  return { barras, larguraTotal: x + 10 };
}

export function normalizarQuantidadeEtiquetas(valor: number) {
  if (!Number.isSafeInteger(valor) || valor < 1 || valor > 500)
    throw new Error("Informe de 1 a 500 etiquetas.");
  return valor;
}

export function normalizarMargemMm(valor: number) {
  if (!Number.isFinite(valor) || valor < 0 || valor > 5)
    throw new Error("A margem deve estar entre 0 e 5 mm.");
  return Math.round(valor * 10) / 10;
}

export function itensPorPagina(formato: FormatoEtiqueta) {
  return formato === "termica" ? 1 : 30;
}

export function paginarEtiquetas(quantidade: number, formato: FormatoEtiqueta) {
  const total = normalizarQuantidadeEtiquetas(quantidade);
  const porPagina = itensPorPagina(formato);
  return Array.from({ length: Math.ceil(total / porPagina) }, (_, pagina) =>
    Array.from({ length: Math.min(porPagina, total - pagina * porPagina) },
      (_, indice) => pagina * porPagina + indice + 1));
}
