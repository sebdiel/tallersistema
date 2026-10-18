import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/auth.decorators';

@Controller()
export class AppController {
  /** Usado por el frontend para saber si hay conexión con el servidor. */
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}
