import { EstadoFisico, Papel, StatusEquipamento } from "@prisma/client";
import { Type, type Static } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import { EquipmentService } from "../services/equipment-service";

const EquipmentParams = Type.Object({ id: Type.String({ format: "uuid" }) });
const StatusBody = Type.Object({
  versaoEsperada: Type.Integer({ minimum: 1 }),
  novoStatus: Type.Enum(StatusEquipamento),
  codigoBarras: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
  destinoFinal: Type.Optional(Type.String({ minLength: 2, maxLength: 180 })),
  justificativa: Type.Optional(Type.String({ maxLength: 500 })),
}, { additionalProperties: false });
type StatusBody = Static<typeof StatusBody>;
const ConditionBody = Type.Object({
  versaoEsperada: Type.Integer({ minimum: 1 }),
  novoEstado: Type.Enum(EstadoFisico),
  justificativa: Type.Optional(Type.String({ maxLength: 500 })),
}, { additionalProperties: false });
type ConditionBody = Static<typeof ConditionBody>;

export async function equipmentRoutes(app: FastifyInstance) {
  const service = new EquipmentService();
  app.get("/equipment", { preHandler: [app.authenticate], schema: { tags: ["Passaporte circular"], summary: "Listar equipamentos", security: [{ bearerAuth: [] }] } }, async () => service.list());
  app.get<{ Params: Static<typeof EquipmentParams> }>("/equipment/:id/trace", {
    preHandler: [app.authorize([Papel.ADMINISTRADOR, Papel.GESTOR_ALMOXARIFADO, Papel.AUDITOR])],
    schema: { tags: ["Passaporte circular"], summary: "Consultar o passaporte e a trilha de custódia", security: [{ bearerAuth: [] }], params: EquipmentParams },
  }, async (request) => service.trace(request.params.id));
  app.patch<{ Params: Static<typeof EquipmentParams>; Body: StatusBody }>("/equipment/:id/status", {
    preHandler: [app.authorize([Papel.ADMINISTRADOR, Papel.GESTOR_ALMOXARIFADO])],
    schema: { tags: ["Passaporte circular"], summary: "Mudar etapa do ciclo; atualização e movimentação são atômicas", security: [{ bearerAuth: [] }], params: EquipmentParams, body: StatusBody },
  }, async (request) => service.changeStatus({ id: request.params.id, usuarioId: request.user.sub, ...request.body }));
  app.patch<{ Params: Static<typeof EquipmentParams>; Body: ConditionBody }>("/equipment/:id/condition", {
    preHandler: [app.authorize([Papel.ADMINISTRADOR, Papel.GESTOR_ALMOXARIFADO])],
    schema: { tags: ["Passaporte circular"], summary: "Atualizar condição física com controle de versão", security: [{ bearerAuth: [] }], params: EquipmentParams, body: ConditionBody },
  }, async (request) => service.changeCondition({ id: request.params.id, usuarioId: request.user.sub, ...request.body }));
}
