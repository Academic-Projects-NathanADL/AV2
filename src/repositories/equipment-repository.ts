import { EstadoFisico, Prisma, StatusEquipamento, StatusLote, TipoMovimentacao } from "@prisma/client";
import { prisma } from "../shared/prisma";
import { badRequest, conflict, notFound } from "../shared/errors";

const STATUS_DESTINO_FINAL = new Set<StatusEquipamento>([
  StatusEquipamento.REUTILIZADO,
  StatusEquipamento.RECICLADO,
  StatusEquipamento.DESCARTE_SEGURO,
]);

type TransitionInput = {
  id: string;
  usuarioId: string;
  versaoEsperada: number;
  novoStatus: StatusEquipamento;
  codigoBarras?: string;
  destinoFinal?: string;
  justificativa?: string;
};

export class EquipmentRepository {
  changeStatus(input: TransitionInput) {
    return prisma.$transaction(async (tx) => {
      const atual = await tx.equipamento.findUnique({ where: { id: input.id } });
      if (!atual) throw notFound("Equipamento");
      if (atual.versao !== input.versaoEsperada) throw conflict("O equipamento mudou desde a última leitura. Atualize os dados e tente novamente.");
      this.validarTransicao(atual.status, input.novoStatus, atual.triagemCompleta);

      const data: Prisma.EquipamentoUpdateManyMutationInput = {
        status: input.novoStatus,
        versao: { increment: 1 },
        ...(input.novoStatus === StatusEquipamento.TRIADO ? { triagemCompleta: true, codigoBarras: input.codigoBarras } : {}),
        ...(input.destinoFinal ? { destinoFinal: input.destinoFinal } : {}),
      };
      const atualizada = await tx.equipamento.updateMany({ where: { id: input.id, versao: input.versaoEsperada }, data });
      if (atualizada.count !== 1) throw conflict("Conflito de concorrência: recarregue o equipamento.");
      const equipamento = await tx.equipamento.findUniqueOrThrow({ where: { id: input.id } });
      await tx.movimentacao.create({
        data: {
          equipamentoId: input.id,
          usuarioId: input.usuarioId,
          tipo: input.novoStatus === StatusEquipamento.TRIADO
            ? TipoMovimentacao.TRIAGEM
            : input.novoStatus === StatusEquipamento.EM_RECUPERACAO
              ? TipoMovimentacao.RECUPERACAO
              : STATUS_DESTINO_FINAL.has(input.novoStatus)
                ? TipoMovimentacao.DESTINO_FINAL
                : TipoMovimentacao.ENCAMINHAMENTO,
          statusAnterior: atual.status,
          statusNovo: input.novoStatus,
          justificativa: input.justificativa ?? null,
        },
      });

      const pendentes = await tx.equipamento.count({
        where: { loteId: equipamento.loteId, status: StatusEquipamento.AGUARDANDO_TRIAGEM },
      });
      const destinosFinais = await tx.equipamento.count({
        where: { loteId: equipamento.loteId, status: { notIn: [StatusEquipamento.REUTILIZADO, StatusEquipamento.RECICLADO, StatusEquipamento.DESCARTE_SEGURO] } },
      });
      const lote = await tx.lote.findUniqueOrThrow({ where: { id: equipamento.loteId } });
      let statusLote: StatusLote | undefined;
      if (input.novoStatus === StatusEquipamento.TRIADO) statusLote = pendentes === 0 ? StatusLote.TRIADO : StatusLote.EM_TRIAGEM;
      if (STATUS_DESTINO_FINAL.has(input.novoStatus) && destinosFinais === 0) statusLote = StatusLote.ENCERRADO;
      if (statusLote && statusLote !== lote.status) {
        const alterado = await tx.lote.updateMany({
          where: { id: lote.id, versao: lote.versao },
          data: { status: statusLote, versao: { increment: 1 } },
        });
        if (alterado.count !== 1) throw conflict("O lote mudou em outra operação. Recarregue seus dados e tente novamente.");
      }
      return equipamento;
    });
  }

  changeCondition(input: { id: string; usuarioId: string; versaoEsperada: number; novoEstado: EstadoFisico; justificativa?: string }) {
    return prisma.$transaction(async (tx) => {
      const atual = await tx.equipamento.findUnique({ where: { id: input.id } });
      if (!atual) throw notFound("Equipamento");
      if (atual.versao !== input.versaoEsperada) throw conflict("O equipamento mudou desde a última leitura. Atualize os dados e tente novamente.");
      const ordem: EstadoFisico[] = [EstadoFisico.EXCELENTE, EstadoFisico.BOM, EstadoFisico.REGULAR, EstadoFisico.RUIM, EstadoFisico.INSERVIVEL];
      const queda = ordem.indexOf(input.novoEstado) - ordem.indexOf(atual.estadoFisico);
      if (queda >= 2 && !input.justificativa?.trim()) throw badRequest("Informe justificativa para uma queda de duas ou mais categorias no estado físico.");

      const atualizada = await tx.equipamento.updateMany({
        where: { id: input.id, versao: input.versaoEsperada },
        data: { estadoFisico: input.novoEstado, versao: { increment: 1 }, justificativa: input.justificativa ?? null },
      });
      if (atualizada.count !== 1) throw conflict("Conflito de concorrência: recarregue o equipamento.");
      const equipamento = await tx.equipamento.findUniqueOrThrow({ where: { id: input.id } });
      await tx.movimentacao.create({
        data: {
          equipamentoId: input.id,
          usuarioId: input.usuarioId,
          tipo: TipoMovimentacao.ALTERACAO_ESTADO,
          estadoAnterior: atual.estadoFisico,
          estadoNovo: input.novoEstado,
          statusAnterior: atual.status,
          statusNovo: atual.status,
          justificativa: input.justificativa ?? null,
        },
      });
      return equipamento;
    });
  }

  private validarTransicao(atual: StatusEquipamento, novo: StatusEquipamento, triagemCompleta: boolean): void {
    const permitidas: Record<StatusEquipamento, StatusEquipamento[]> = {
      AGUARDANDO_TRIAGEM: [StatusEquipamento.TRIADO],
      TRIADO: [StatusEquipamento.DESMONTE, StatusEquipamento.EM_RECUPERACAO, StatusEquipamento.RECICLADO, StatusEquipamento.DESCARTE_SEGURO],
      DESMONTE: [StatusEquipamento.EM_RECUPERACAO, StatusEquipamento.RECICLADO, StatusEquipamento.DESCARTE_SEGURO],
      EM_RECUPERACAO: [StatusEquipamento.REUTILIZADO, StatusEquipamento.RECICLADO, StatusEquipamento.DESCARTE_SEGURO],
      REUTILIZADO: [], RECICLADO: [], DESCARTE_SEGURO: [],
    };
    if (!permitidas[atual].includes(novo)) throw conflict(`Transição de ${atual} para ${novo} não é permitida.`);
    if (novo === StatusEquipamento.DESMONTE && !triagemCompleta) throw conflict("A desmontagem exige triagem completa.");
  }

  trace(id: string) {
    return prisma.equipamento.findUnique({
      where: { id },
      include: {
        lote: { include: { organizacao: { select: { razaoSocial: true, cnpj: true } } } },
        movimentacoes: { include: { usuario: { select: { login: true, papel: true } } }, orderBy: { ocorridoEm: "asc" } },
      },
    });
  }

  list() {
    return prisma.equipamento.findMany({ include: { lote: { select: { codigoPublico: true } } }, orderBy: { atualizadoEm: "desc" } });
  }
}
