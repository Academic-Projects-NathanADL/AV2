import { Papel } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { UserRepository } from "../repositories/user-repository";
import { badRequest, unauthorized } from "../shared/errors";
import { hashPassword, verifyPassword } from "../shared/password";

const users = new UserRepository();

export class AuthService {
  constructor(private readonly app: FastifyInstance) {}

  async login(login: string, password: string) {
    const user = await users.findByLogin(login);
    if (!user || !user.ativo || !(await verifyPassword(password, user.senhaHash))) throw unauthorized();
    const accessToken = await this.app.jwt.sign({ sub: user.id, login: user.login, papel: user.papel });
    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: process.env.JWT_EXPIRES_IN ?? "30m",
      usuario: { id: user.id, login: user.login, nomeCompleto: user.nomeCompleto, papel: user.papel },
    };
  }

  async createUser(input: { login: string; nomeCompleto: string; senha: string; papel: Papel }) {
    if (input.senha.length < 10) throw badRequest("A senha deve possuir ao menos 10 caracteres.");
    if (!input.nomeCompleto.trim()) throw badRequest("Nome completo obrigatório.");
    return users.create({
      login: input.login.trim().toLowerCase(),
      nomeCompleto: input.nomeCompleto.trim(),
      senhaHash: await hashPassword(input.senha),
      papel: input.papel,
    });
  }
}
