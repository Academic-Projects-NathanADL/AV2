/** Pure calculation in integer cents and basis points (1 bp = 0.01%). */
export function calcularEstimativaFinanceira(input: {
  valorAquisicaoCentavos: number;
  idadeMeses: number;
  coeficienteDepreciacaoAnualBps: number;
  aliquotaImpostoBps: number;
}) {
  const { valorAquisicaoCentavos, idadeMeses, coeficienteDepreciacaoAnualBps, aliquotaImpostoBps } = input;
  const fatorRestanteBps = Math.max(0, 10_000 - (coeficienteDepreciacaoAnualBps * idadeMeses) / 12);
  const valorContabilCentavos = Math.round((valorAquisicaoCentavos * fatorRestanteBps) / 10_000);
  const impostoPrevistoCentavos = Math.round((valorContabilCentavos * aliquotaImpostoBps) / 10_000);
  return {
    valorAquisicaoCentavos,
    idadeMeses,
    valorDepreciadoCentavos: valorAquisicaoCentavos - valorContabilCentavos,
    valorContabilCentavos,
    aliquotaImpostoBps,
    impostoPrevistoCentavos,
    valorLiquidoEstimadoCentavos: Math.max(0, valorContabilCentavos - impostoPrevistoCentavos),
  };
}
