import { Papel } from "@prisma/client";
import { Type, type Static } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import { AuthService } from "../services/auth-service";

const CreateUserBody = Type.Object({
  login: Type.String({ minLength: 3, maxLength: 60, pattern: "^[a-zA-Z0-9._-]+$" }),
  nomeCompleto: Type.String({ minLength: 3, maxLength: 160 }),
  senha: Type.String({ minLength: 10, maxLength: 100 }),
  papel: Type.Enum(Papel),
}, { additionalProperties: false });
type CreateUserBody = Static<typeof CreateUserBody>;

export async function userRoutes(app: FastifyInstance) {
  const service = new AuthService(app);
  app.post<{ Body: CreateUserBody }>("/users", {
    preHandler: [app.authorize([Papel.ADMINISTRADOR])],
    schema: { tags: ["Contas"], summary: "Criar conta de acesso", security: [{ bearerAuth: [] }], body: CreateUserBody },
  }, async (request, reply) => reply.code(201).send(await service.createUser(request.body)));
}
