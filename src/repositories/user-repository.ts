import { Papel } from "@prisma/client";
import { prisma } from "../shared/prisma";

export class UserRepository {
  findByLogin(login: string) {
    return prisma.usuario.findUnique({ where: { login } });
  }

  create(data: { login: string; nomeCompleto: string; senhaHash: string; papel: Papel }) {
    return prisma.usuario.create({ data, select: { id: true, login: true, nomeCompleto: true, papel: true, ativo: true, versao: true, criadoEm: true } });
  }
}
