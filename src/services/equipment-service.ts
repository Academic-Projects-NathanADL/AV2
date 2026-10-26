import { EstadoFisico, StatusEquipamento } from "@prisma/client";
import { EquipmentRepository } from "../repositories/equipment-repository";
import { badRequest, notFound } from "../shared/errors";
import { prisma } from "../shared/prisma";

const equipment = new EquipmentRepository();

export class EquipmentService {
  async changeStatus(input: {
    id: string; usuarioId: string; versaoEsperada: number; novoStatus: StatusEquipamento;
    codigoBarras?: string; destinoFinal?: string; justificativa?: string;
  }) {
    if (input.novoStatus === StatusEquipamento.TRIADO && !input.codigoBarras?.trim()) throw badRequest("Código de barras é obrigatório na triagem.");
    const statusDeDestino = new Set<StatusEquipamento>([StatusEquipamento.REUTILIZADO, StatusEquipamento.RECICLADO, StatusEquipamento.DESCARTE_SEGURO]);
    if (statusDeDestino.has(input.novoStatus) && !input.destinoFinal?.trim()) {
      throw badRequest("Informe o destino final para encerrar o passaporte circular.");
    }
    return equipment.changeStatus(input);
  }

  changeCondition(input: { id: string; usuarioId: string; versaoEsperada: number; novoEstado: EstadoFisico; justificativa?: string }) {
    return equipment.changeCondition(input);
  }

  async trace(id: string) {
    const result = await equipment.trace(id);
    if (!result) throw notFound("Equipamento");
    return {
      identidade: { id: result.id, codigoRastreio: result.codigoRastreio, codigoBarras: result.codigoBarras, tipo: result.tipo },
      origem: { lote: result.lote.codigoPublico, notaFiscal: result.lote.notaFiscal, organizacao: result.lote.organizacao.razaoSocial, cnpj: result.lote.organizacao.cnpj },
      situacao: { estadoFisico: result.estadoFisico, status: result.status, versao: result.versao, destinoFinal: result.destinoFinal },
      trilha: result.movimentacoes.map((mov) => ({ tipo: mov.tipo, statusAnterior: mov.statusAnterior, statusNovo: mov.statusNovo, estadoAnterior: mov.estadoAnterior, estadoNovo: mov.estadoNovo, justificativa: mov.justificativa, ocorridoEm: mov.ocorridoEm, ator: mov.usuario.login })),
    };
  }

  list() { return equipment.list(); }

  async report() {
    const [equipamentos, lotes, organizacoes] = await Promise.all([
      prisma.equipamento.findMany({ select: { status: true } }),
      prisma.lote.count(),
      prisma.organizacao.count({ where: { ativa: true } }),
    ]);
    const { calcularPainelCircular } = await import("../domain/circularity");
    return { organizacoesAtivas: organizacoes, lotesRecebidos: lotes, ...calcularPainelCircular(equipamentos.map((item) => item.status)) };
  }
}
