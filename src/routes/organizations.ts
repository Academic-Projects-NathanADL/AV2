import { TipoOrganizacao, Papel } from "@prisma/client";
import { Type, type Static } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import { OrganizationService } from "../services/organization-service";

const CreateOrganizationBody = Type.Object({
  cnpj: Type.String({ minLength: 14, maxLength: 18 }),
  razaoSocial: Type.String({ minLength: 2, maxLength: 180 }),
  tipo: Type.Enum(TipoOrganizacao),
}, { additionalProperties: false });
type CreateOrganizationBody = Static<typeof CreateOrganizationBody>;
const ContractBody = Type.Object({
  numero: Type.String({ minLength: 1, maxLength: 60 }),
  dataInicio: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
  prazoArmazenamentoDias: Type.Integer({ minimum: 1, maximum: 3650 }),
}, { additionalProperties: false });
type ContractBody = Static<typeof ContractBody>;
const OrganizationParams = Type.Object({ id: Type.String({ format: "uuid" }) });

export async function organizationRoutes(app: FastifyInstance) {
  const service = new OrganizationService();
  app.get("/organizations", { preHandler: [app.authenticate], schema: { tags: ["Organizações"], summary: "Listar organizações com contratos e lotes", security: [{ bearerAuth: [] }] } }, async () => service.list());

  app.post<{ Body: CreateOrganizationBody }>("/organizations", {
    preHandler: [app.authorize([Papel.ADMINISTRADOR, Papel.OPERADOR_CADASTRO])],
    schema: { tags: ["Organizações"], summary: "Cadastrar organização geradora", security: [{ bearerAuth: [] }], body: CreateOrganizationBody },
  }, async (request, reply) => reply.code(201).send(await service.create(request.body)));

  app.post<{ Params: Static<typeof OrganizationParams>; Body: ContractBody }>("/organizations/:id/contracts", {
    preHandler: [app.authorize([Papel.ADMINISTRADOR, Papel.OPERADOR_CADASTRO])],
    schema: { tags: ["Organizações"], summary: "Associar contrato de coleta", security: [{ bearerAuth: [] }], params: OrganizationParams, body: ContractBody },
  }, async (request, reply) => reply.code(201).send(await service.createContract({ organizacaoId: request.params.id, ...request.body })));
}
