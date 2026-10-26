import { Prisma, TipoEquipamento, EstadoFisico } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { OrganizationRepository } from "../repositories/organization-repository";
import { LotRepository } from "../repositories/lot-repository";
import { badRequest, notFound } from "../shared/errors";

const organizations = new OrganizationRepository();
const lots = new LotRepository();

export class LotService {
  async create(input: {
    organizacaoId: string;
    notaFiscal: string;
    transportadora: string;
    dataEntrada: string;
    equipamentos: Array<{ tipo: TipoEquipamento; estadoFisico: EstadoFisico; valorAquisicaoCentavos?: number; idadeMeses?: number }>;
    usuarioId: string;
  }) {
    if (!(await organizations.has(input.organizacaoId))) throw notFound("Organização");
    if (!input.notaFiscal.trim() || !input.transportadora.trim()) throw badRequest("Nota fiscal e transportadora são obrigatórias.");
    const dataEntrada = new Date(input.dataEntrada);
    if (Number.isNaN(dataEntrada.getTime()) || dataEntrada.toISOString().slice(0, 10) !== input.dataEntrada) throw badRequest("Data de entrada inválida; use AAAA-MM-DD.");
    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);
    const entradaUtc = new Date(`${input.dataEntrada}T00:00:00.000Z`);
    const limite = new Date(hoje.getTime() - 90 * 86400000);
    if (entradaUtc > hoje) throw badRequest("A data de entrada do lote não pode ser futura.");
    if (entradaUtc < limite) throw badRequest("A data de entrada não pode ser anterior a mais de 90 dias.");
    if (input.equipamentos.length > 250) throw badRequest("Um lote pode conter no máximo 250 equipamentos por operação.");
    for (const item of input.equipamentos) {
      if ((item.valorAquisicaoCentavos === undefined) !== (item.idadeMeses === undefined)) {
        throw badRequest("Informe valor de aquisição e idade em meses juntos para calcular a estimativa financeira.");
      }
    }

    const codigoPublico = `CV-${randomBytes(4).toString("hex").toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    return lots.createWithEquipment({
      codigoPublico,
      organizacaoId: input.organizacaoId,
      notaFiscal: input.notaFiscal.trim(),
      transportadora: input.transportadora.trim(),
      dataEntrada: entradaUtc,
      equipamentos: input.equipamentos as Array<{ tipo: Prisma.EquipamentoCreateInput["tipo"]; estadoFisico: Prisma.EquipamentoCreateInput["estadoFisico"] }>,
      usuarioId: input.usuarioId,
    });
  }

  list() { return lots.list(); }
}
