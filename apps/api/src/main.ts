import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ENV, type Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const env = app.get<Env>(ENV);
  app.enableShutdownHooks();
  // Atrás do balanceador da nuvem, para req.ip ser o IP real.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  await app.listen(env.PORT);
  Logger.log(`API do Bastião ouvindo na porta ${env.PORT}`, 'Bootstrap');
}

void bootstrap();
