import { Papel } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { EquipmentService } from "../services/equipment-service";

export async function reportRoutes(app: FastifyInstance) {
  const service = new EquipmentService();
  app.get("/reports/circularity", {
    preHandler: [app.authorize([Papel.ADMINISTRADOR, Papel.AUDITOR])],
    schema: { tags: ["Painel Circuito Vivo"], summary: "Indicadores de destino circular e fila operacional", security: [{ bearerAuth: [] }] },
  }, async () => service.report());
}
