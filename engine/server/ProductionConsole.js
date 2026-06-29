/**
 * Production server console output — minimal, no colors required.
 */
export class ProductionConsole {
  static printStartup({ bind, url, env, name }) {
    const port = new URL(url).port;

    console.log(`[Taand] ${name} · ${env}`);

    if (bind === '0.0.0.0' || bind === '::') {
      console.log(`[Taand] Server running on all interfaces · port ${port}`);
    } else {
      console.log(`[Taand] Server running at ${url}`);
    }
  }

  static printStopping() {
    console.log('[Taand] Graceful shutdown started...');
  }

  static printStopped() {
    console.log('[Taand] Server stopped');
  }
}
