import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logging/logger.module';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [AppConfigModule, LoggerModule, HealthModule],
})
export class AppModule {}
