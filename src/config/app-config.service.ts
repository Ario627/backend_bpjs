import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from './configuration';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Injectable()
export class AppConfigService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get value(): AppConfig {
    return this.config;
  }

  get isProduction(): boolean {
    return this.config.isProduction;
  }

  get isTest(): boolean {
    return this.config.isTest;
  }
}