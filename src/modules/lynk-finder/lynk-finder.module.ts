import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LynkFinderGateway } from './lynk-finder.gateway';
import { LynkFinderService } from './lynk-finder.service';
import { LynkFinderSocketRegistry } from './lynk-finder-socket-registry.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [LynkFinderGateway, LynkFinderService, LynkFinderSocketRegistry],
})
export class LynkFinderModule {}
