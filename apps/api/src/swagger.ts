import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** OpenAPI page at /docs (not in production). Handy for trying routes with a Bearer token. */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder().setTitle('Coach Connect API').setVersion('0.0.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
