import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, AppConfigService } from './app-config.service';
import { loadAppConfig } from './configuration';

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => loadAppConfig(),
    },
    AppConfigService,
  ],
  exports: [AppConfigService],  
})
export class AppConfigModule {}