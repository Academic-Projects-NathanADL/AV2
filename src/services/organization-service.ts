import { OrganizationRepository } from "../repositories/organization-repository";
import { badRequest, notFound } from "../shared/errors";
import { normalizarCnpj } from "../shared/cnpj";

const repository = new OrganizationRepository();

export class OrganizationService {
  async create(input: { cnpj: string; razaoSocial: string; tipo: "VAREJO" | "SAUDE" | "EDUCACAO" | "BANCARIO" | "INDUSTRIA" | "OUTRO" }) {
    let cnpj: string;
    try { cnpj = normalizarCnpj(input.cnpj); }
    catch (error) { throw badRequest((error as Error).message); }
    if (!input.razaoSocial.trim()) throw badRequest("Razão social obrigatória.");
    return repository.create({ cnpj, razaoSocial: input.razaoSocial.trim(), tipo: input.tipo });
  }

  list() { return repository.list(); }

  async createContract(input: { organizacaoId: string; numero: string; dataInicio: string; prazoArmazenamentoDias: number }) {
    if (!(await repository.has(input.organizacaoId))) throw notFound("Organização");
    if (!input.numero.trim()) throw badRequest("Número do contrato obrigatório.");
    if (!Number.isFinite(input.prazoArmazenamentoDias) || input.prazoArmazenamentoDias < 1 || input.prazoArmazenamentoDias > 3650) {
      throw badRequest("O prazo de armazenamento deve ficar entre 1 e 3650 dias.");
    }
    const data = new Date(`${input.dataInicio}T00:00:00.000Z`);
    if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== input.dataInicio) throw badRequest("Data de início inválida; use AAAA-MM-DD.");
    return repository.createContract(input.organizacaoId, input.numero.trim(), data, input.prazoArmazenamentoDias);
  }
}
