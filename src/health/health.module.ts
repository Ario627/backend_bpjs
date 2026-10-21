import { Module } from '@nestjs/common';
import { DatabaseHealthIndicator } from '../infrastructure/database/database.health';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { HealthController } from './health.controller';
import { HEALTH_INDICATORS } from './health.indicator';
import { HealthService } from './health.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    {
      provide: HEALTH_INDICATORS,
      useFactory: (prisma: PrismaService) => [new DatabaseHealthIndicator(prisma)],
      inject: [PrismaService],
    },
  ],
})
export class HealthModule {}