import { Papel } from "@prisma/client";
import { Type, type Static } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import { badRequest, conflict, notFound } from "../shared/errors";
import { prisma } from "../shared/prisma";
import { calcularEstimativaFinanceira } from "../domain/financial";

const EquipmentParams = Type.Object({ id: Type.String({ format: "uuid" }) });
const ParametersBody = Type.Object({
  versaoEsperada: Type.Integer({ minimum: 1 }),
  aliquotaImpostoBps: Type.Integer({ minimum: 0, maximum: 10_000 }),
  coeficienteDepreciacaoAnualBps: Type.Integer({ minimum: 0, maximum: 10_000 }),
}, { additionalProperties: false });
type ParametersBody = Static<typeof ParametersBody>;

export async function financialRoutes(app: FastifyInstance) {
  app.get("/settings/financial", {
    preHandler: [app.authorize([Papel.ADMINISTRADOR])],
    schema: { tags: ["Financeiro"], summary: "Consultar alíquota de imposto e coeficiente anual de depreciação", security: [{ bearerAuth: [] }] },
  }, async () => prisma.parametroFinanceiro.upsert({
    where: { id: 1 }, create: { id: 1 }, update: {},
  }));

  app.put<{ Body: ParametersBody }>("/settings/financial", {
    preHandler: [app.authorize([Papel.ADMINISTRADOR])],
    schema: { tags: ["Financeiro"], summary: "Atualizar parâmetros financeiros globais com controle de versão", security: [{ bearerAuth: [] }], body: ParametersBody },
  }, async (request) => {
    const { versaoEsperada, aliquotaImpostoBps, coeficienteDepreciacaoAnualBps } = request.body;
    const current = await prisma.parametroFinanceiro.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
    if (current.versao !== versaoEsperada) throw conflict("Parâmetros financeiros alterados por outro usuário; recarregue antes de salvar.");
    const result = await prisma.parametroFinanceiro.updateMany({
      where: { id: 1, versao: versaoEsperada },
      data: { aliquotaImpostoBps, coeficienteDepreciacaoAnualBps, versao: { increment: 1 } },
    });
    if (result.count !== 1) throw conflict("Parâmetros financeiros alterados por outro usuário; recarregue antes de salvar.");
    return prisma.parametroFinanceiro.findUniqueOrThrow({ where: { id: 1 } });
  });

  app.get<{ Params: Static<typeof EquipmentParams> }>("/equipment/:id/valuation", {
    preHandler: [app.authorize([Papel.ADMINISTRADOR, Papel.GESTOR_ALMOXARIFADO, Papel.AUDITOR])],
    schema: { tags: ["Financeiro"], summary: "Simular valor contábil após depreciação e imposto configurados", security: [{ bearerAuth: [] }], params: EquipmentParams },
  }, async (request) => {
    const item = await prisma.equipamento.findUnique({ where: { id: request.params.id }, select: { id: true, codigoRastreio: true, valorAquisicaoCentavos: true, idadeMeses: true } });
    if (!item) throw notFound("Equipamento");
    if (item.valorAquisicaoCentavos === null || item.idadeMeses === null) {
      throw badRequest("Este equipamento não possui valor de aquisição e idade cadastrados para estimativa.");
    }
    const settings = await prisma.parametroFinanceiro.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
    return {
      equipamento: { id: item.id, codigoRastreio: item.codigoRastreio },
      estimativa: calcularEstimativaFinanceira({
        valorAquisicaoCentavos: item.valorAquisicaoCentavos,
        idadeMeses: item.idadeMeses,
        coeficienteDepreciacaoAnualBps: settings.coeficienteDepreciacaoAnualBps,
        aliquotaImpostoBps: settings.aliquotaImpostoBps,
      }),
      parametrosVersao: settings.versao,
      observacao: "Simulação operacional linear; não substitui avaliação contábil ou tributária.",
    };
  });
}
