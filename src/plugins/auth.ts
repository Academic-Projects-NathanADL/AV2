import jwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import { forbidden, unauthorized } from "../shared/errors";

export type Papel = "ADMINISTRADOR" | "OPERADOR_CADASTRO" | "GESTOR_ALMOXARIFADO" | "AUDITOR";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; login: string; papel: Papel };
    user: { sub: string; login: string; papel: Papel };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
    authorize: (papeis: Papel[]) => preHandlerHookHandler;
  }
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET deve possuir ao menos 32 caracteres.");

  await app.register(jwt, {
    secret,
    sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? "30m", algorithm: "HS256" },
  });

  app.decorate("authenticate", async function (request: FastifyRequest, _reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      throw unauthorized();
    }
  });

  app.decorate("authorize", (papeis: Papel[]) => async function (request: FastifyRequest) {
    try {
      await request.jwtVerify();
    } catch {
      throw unauthorized();
    }
    if (!papeis.includes(request.user.papel)) throw forbidden();
  });
}
