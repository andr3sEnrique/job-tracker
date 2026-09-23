import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/app-config.service.js';
import { configureApp } from './configure-app.js';

const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
configureApp(app);

const port = app.get(AppConfig).get('PORT');
await app.listen(port);
app.get(Logger).log(`API listening on http://localhost:${port}`);
