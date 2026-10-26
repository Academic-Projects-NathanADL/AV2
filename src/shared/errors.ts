export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string) => new AppError(message, 400, "BAD_REQUEST");
export const unauthorized = () => new AppError("Credenciais ou token inválidos.", 401, "UNAUTHORIZED");
export const forbidden = () => new AppError("Seu perfil não pode executar esta operação.", 403, "FORBIDDEN");
export const notFound = (entity: string) => new AppError(`${entity} não encontrado.`, 404, "NOT_FOUND");
export const conflict = (message: string) => new AppError(message, 409, "CONFLICT");
