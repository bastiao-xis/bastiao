import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Converte violação de unicidade em 409 com mensagem clara. */
export async function uniqueOr409<T>(op: Promise<T>, message: string): Promise<T> {
  try {
    return await op;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException(message);
    }
    throw e;
  }
}
