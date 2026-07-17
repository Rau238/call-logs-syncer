import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { getDashboardDistPath } from './utils/dashboard';
import { logger } from './utils/logger';

export function createApp(): express.Application {
  const app = express();
  const dashboardDist = getDashboardDistPath();

  // Helmet only on API routes — don't break dashboard static assets
  app.use('/api', helmet());

  app.use(
    cors({
      origin: config.cors.origin === '*' ? true : config.cors.origin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      db: 'postgresql',
      dashboard: dashboardDist ? 'served' : 'not-built',
      timestamp: new Date().toISOString(),
    });
  });

  // ── API ──────────────────────────────────────────────────────────
  app.use('/api/v1', routes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  // ── Dashboard (same origin as API) ───────────────────────────────
  if (dashboardDist) {
    app.use(express.static(dashboardDist));

    // SPA fallback — React client-side routing
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(dashboardDist, 'index.html'));
    });

    logger.info(`Dashboard served from ${dashboardDist}`);
  } else {
    logger.warn(
      'Dashboard not built. Run: npm run build -w @call-log/dashboard'
    );
  }

  app.use(errorHandler);

  return app;
}

export function startServer(): void {
  const app = createApp();
  app.listen(config.port, () => {
    logger.info(`Server running on http://localhost:${config.port}`);
    logger.info(`  API:       http://localhost:${config.port}/api/v1`);
    logger.info(`  Dashboard: http://localhost:${config.port}/`);
    logger.info(`  Health:    http://localhost:${config.port}/health`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Database: PostgreSQL @ ${config.db.host}:${config.db.port}`);
  });
}
