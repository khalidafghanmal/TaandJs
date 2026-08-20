import { loadRoutesCached, renderRouteTable } from '../../cache/RouteCache.js';

export class RouteListCommand {
  name = 'route:list';
  description = 'List all registered routes';
  usage = 'route:list';

  async run() {
    const rows = await loadRoutesCached(import.meta.url);
    process.stdout.write(renderRouteTable(rows));
  }
}
