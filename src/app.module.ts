import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logging/logger.module';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './infrastructure/database/prisma.module';

@Module({
  imports: [AppConfigModule, LoggerModule, PrismaModule, HealthModule],
})
export class AppModule {}
