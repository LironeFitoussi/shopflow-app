import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { ProductsModule } from './products/products.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [DatabaseModule, CacheModule, ProductsModule],
  controllers: [HealthController],
})
export class AppModule {}
