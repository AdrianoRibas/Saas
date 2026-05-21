import { Request, Response, NextFunction } from "express";
import { z } from "zod";

// Interface para erros customizados
export class AppError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Middleware de tratamento de erros global
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error("Error:", err);

  // Erro customizado da aplicação
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  // Erros do Prisma
  if (err.name === "PrismaClientKnownRequestError") {
    console.error("[Prisma Error details]:", (err as any).code, (err as any).meta, err.message);
    return res.status(400).json({
      error: "Erro de banco de dados",
      code: "DATABASE_ERROR",
    });
  }

  // Erro de validação do Zod
  if (err instanceof z.ZodError || err.name === "ZodError" || (err as any).code === "ZOD_ERROR") {
    return res.status(400).json({
      error: "Dados inválidos",
      code: "VALIDATION_ERROR",
      details: (err as any).errors || (err as any).issues || [{ message: err.message }],
    });
  }

  // Erro genérico
  return res.status(500).json({
    error: "Erro interno do servidor",
    code: "INTERNAL_ERROR",
  });
}

// Wrapper para funções assíncronas (evita try/catch repetitivo)
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
