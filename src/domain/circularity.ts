import { StatusEquipamento } from "@prisma/client";

const DESTINOS_CIRCULARES = new Set<StatusEquipamento>([
  StatusEquipamento.REUTILIZADO,
  StatusEquipamento.RECICLADO,
]);

/** Indicador operacional de destino circular, não uma estimativa de CO₂ evitado. */
export function calcularPainelCircular(statuses: StatusEquipamento[]) {
  const porStatus = statuses.reduce<Record<string, number>>((acc, status) => {
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  const total = statuses.length;
  const destinosCirculares = statuses.filter((status) => DESTINOS_CIRCULARES.has(status)).length;
  return {
    totalEquipamentos: total,
    destinosCirculares,
    aguardandoDestino: porStatus.AGUARDANDO_TRIAGEM ?? 0,
    indiceCircularOperacional: total === 0 ? 0 : Math.round((destinosCirculares / total) * 100),
    porStatus,
    descricaoIndice: "Percentual de equipamentos reutilizados ou reciclados no universo cadastrado.",
  };
}
