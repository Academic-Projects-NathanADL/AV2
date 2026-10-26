import "dotenv/config";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { registerAuth } from "./plugins/auth";
import { authRoutes } from "./routes/auth";
import { equipmentRoutes } from "./routes/equipment";
import { financialRoutes } from "./routes/financial";
import { lotRoutes } from "./routes/lots";
import { organizationRoutes } from "./routes/organizations";
import { reportRoutes } from "./routes/reports";
import { userRoutes } from "./routes/users";
import { AppError } from "./shared/errors";
import { prisma } from "./shared/prisma";

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info", redact: ["req.headers.authorization", "req.body.senha"] },
    trustProxy: process.env.TRUST_PROXY === "true",
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(",").map((item) => item.trim()) ?? ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST", "PATCH", "PUT", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await registerAuth(app);
  await app.register(swagger, {
    openapi: {
      info: {
        title: "GreenCode — Circuito Vivo API",
        description: "Passaporte circular e trilha de custódia para equipamentos eletrônicos.",
        version: "2.0.0",
      },
      tags: [
        { name: "Autenticação", description: "Sessão stateless com JWT" },
        { name: "Organizações", description: "Geradores e contratos de coleta" },
        { name: "Lotes", description: "Recebimento de remessas" },
        { name: "Passaporte circular", description: "Histórico de vida do equipamento" },
        { name: "Painel Circuito Vivo", description: "Indicadores operacionais de destino circular" },
        { name: "Financeiro", description: "Estimativas com parâmetros configuráveis pelo administrador" },
        { name: "Contas", description: "Gestão de acessos" },
      ],
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs", uiConfig: { docExpansion: "list", deepLinking: true } });

  app.get("/health", { schema: { tags: ["Sistema"], summary: "Verificar disponibilidade e conexão com banco" } }, async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", produto: "GreenCode — Circuito Vivo", banco: "conectado", horario: new Date().toISOString() };
  });

  app.setErrorHandler((error: Error & { code?: string; statusCode?: number; validation?: unknown }, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ erro: { codigo: error.code, mensagem: error.message, requisicao: request.id } });
    }
    const code = "code" in error ? error.code : undefined;
    if (code === "P2002") return reply.code(409).send({ erro: { codigo: "UNIQUE_CONFLICT", mensagem: "Já existe um registro com um dos campos informados.", requisicao: request.id } });
    if (code === "P2003") return reply.code(409).send({ erro: { codigo: "RELATION_CONFLICT", mensagem: "A operação viola um relacionamento existente.", requisicao: request.id } });
    if (error.validation) return reply.code(400).send({ erro: { codigo: "VALIDATION_ERROR", mensagem: "Os dados enviados não passaram pela validação.", requisicao: request.id, campos: error.validation } });
    request.log.error({ err: error }, "Falha não tratada na API");
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    return reply.code(status).send({ erro: { codigo: status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR", mensagem: status === 500 ? "Ocorreu uma falha interna." : error.message, requisicao: request.id } });
  });

  await app.register(authRoutes, { prefix: "/api/v1" });
  await app.register(userRoutes, { prefix: "/api/v1" });
  await app.register(organizationRoutes, { prefix: "/api/v1" });
  await app.register(lotRoutes, { prefix: "/api/v1" });
  await app.register(equipmentRoutes, { prefix: "/api/v1" });
  await app.register(financialRoutes, { prefix: "/api/v1" });
  await app.register(reportRoutes, { prefix: "/api/v1" });

  app.addHook("onClose", async () => prisma.$disconnect());
  return app;
}

async function main() {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 3333);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT deve ser um inteiro entre 1 e 65535.");
  await app.listen({ port, host: process.env.HOST ?? "0.0.0.0" });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Encerramento gracioso iniciado");
    await app.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error("Não foi possível iniciar o Circuito Vivo:", error);
    process.exit(1);
  });
}
