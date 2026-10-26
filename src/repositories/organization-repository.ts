import { prisma } from "../shared/prisma";

export class OrganizationRepository {
  create(data: { cnpj: string; razaoSocial: string; tipo: "VAREJO" | "SAUDE" | "EDUCACAO" | "BANCARIO" | "INDUSTRIA" | "OUTRO" }) {
    return prisma.organizacao.create({ data, select: { id: true, cnpj: true, razaoSocial: true, tipo: true, versao: true, criadoEm: true } });
  }

  list() {
    return prisma.organizacao.findMany({
      where: { ativa: true },
      include: { contrato: true, _count: { select: { lotes: true } } },
      orderBy: { razaoSocial: "asc" },
    });
  }

  async has(id: string): Promise<boolean> {
    return (await prisma.organizacao.count({ where: { id, ativa: true } })) > 0;
  }

  createContract(organizacaoId: string, numero: string, dataInicio: Date, prazoArmazenamentoDias: number) {
    return prisma.contrato.create({
      data: { organizacaoId, numero, dataInicio, prazoArmazenamentoDias },
      select: { id: true, numero: true, dataInicio: true, prazoArmazenamentoDias: true, ativo: true, versao: true, organizacaoId: true },
    });
  }
}
