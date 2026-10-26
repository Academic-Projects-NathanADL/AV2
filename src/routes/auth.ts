import { Type, type Static } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import { AuthService } from "../services/auth-service";

const LoginBody = Type.Object({
  login: Type.String({ minLength: 1, maxLength: 60 }),
  senha: Type.String({ minLength: 1, maxLength: 100 }),
}, { additionalProperties: false });
type LoginBody = Static<typeof LoginBody>;

export async function authRoutes(app: FastifyInstance) {
  const service = new AuthService(app);
  app.post<{ Body: LoginBody }>("/auth/login", {
    config: { rateLimit: { max: 8, timeWindow: "1 minute" } },
    schema: {
      tags: ["Autenticação"], summary: "Entrar e receber um JWT", body: LoginBody,
      response: { 200: Type.Object({ accessToken: Type.String(), tokenType: Type.String(), expiresIn: Type.String(), usuario: Type.Object({ id: Type.String(), login: Type.String(), nomeCompleto: Type.String(), papel: Type.String() }) }) },
    },
  }, async (request) => service.login(request.body.login, request.body.senha));
}
