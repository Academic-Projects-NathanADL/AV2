import { EstadoFisico, Papel, TipoEquipamento } from "@prisma/client";
import { Type, type Static } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import { LotService } from "../services/lot-service";

const EquipmentInput = Type.Object({
  tipo: Type.Enum(TipoEquipamento),
  estadoFisico: Type.Enum(EstadoFisico),
  valorAquisicaoCentavos: Type.Optional(Type.Integer({ minimum: 0, maximum: 100000000000 })),
  idadeMeses: Type.Optional(Type.Integer({ minimum: 0, maximum: 1200 })),
}, { additionalProperties: false });
const CreateLotBody = Type.Object({
  organizacaoId: Type.String({ format: "uuid" }),
  notaFiscal: Type.String({ minLength: 1, maxLength: 60 }),
  transportadora: Type.String({ minLength: 2, maxLength: 120 }),
  dataEntrada: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
  equipamentos: Type.Array(EquipmentInput, { minItems: 1, maxItems: 250 }),
}, { additionalProperties: false });
type CreateLotBody = Static<typeof CreateLotBody>;

export async function lotRoutes(app: FastifyInstance) {
  const service = new LotService();
  app.get("/lots", { preHandler: [app.authenticate], schema: { tags: ["Lotes"], summary: "Listar lotes com contagem de equipamentos", security: [{ bearerAuth: [] }] } }, async () => service.list());
  app.post<{ Body: CreateLotBody }>("/lots", {
    preHandler: [app.authorize([Papel.ADMINISTRADOR, Papel.GESTOR_ALMOXARIFADO])],
    schema: { tags: ["Lotes"], summary: "Receber lote e registrar equipamentos em uma transação", security: [{ bearerAuth: [] }], body: CreateLotBody },
  }, async (request, reply) => reply.code(201).send(await service.create({ ...request.body, usuarioId: request.user.sub })));
}
