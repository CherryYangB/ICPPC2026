import 'dotenv/config'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

  app.useWebSocketAdapter(new IoAdapter(app))
  app.setGlobalPrefix('api')

  const trustProxy = config.get<number>('trustProxy', 1)
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxy)

  const corsOrigins = config.get<string[]>('corsOrigins', [])
  app.enableCors({ origin: corsOrigins, credentials: true })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  app.useGlobalFilters(new AllExceptionsFilter())

  if (config.get<boolean>('swaggerEnabled', true)) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ICPPC 2026 Interaction API')
      .setDescription('Conference interaction system backend')
      .setVersion('1.0')
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('api/docs', app, document)
  }

  const port = config.get<number>('port', 3000)
  await app.listen(port)
  console.log(`ICPPC 2026 API listening on http://localhost:${port}/api`)
}

void bootstrap()