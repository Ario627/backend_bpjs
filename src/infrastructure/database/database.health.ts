import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import type { HealthIndicator } from "@/health/health.indicator";

@Injectable()
export class DatabaseHealthIndicator implements HealthIndicator {
  readonly name = 'postgres';
  readonly critical = true;

  constructor(private readonly prisma: PrismaService) {}

  async ping(): Promise<void> {
    await this.prisma.ping();
  }
}