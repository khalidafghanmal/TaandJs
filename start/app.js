import { Application } from '../engine/core/Application.js';
import { resolveProjectRoot } from '../engine/server/resolveRoot.js';
import { routesFilePath } from '../engine/core/ProjectPaths.js';
import { AppServiceProvider } from '../engine/providers/AppServiceProvider.js';
import { MiddlewareServiceProvider } from '../engine/providers/MiddlewareServiceProvider.js';
import { ViewServiceProvider } from '../engine/providers/ViewServiceProvider.js';
import { ControllerServiceProvider } from '../engine/providers/ControllerServiceProvider.js';
import { AssetServiceProvider } from '../engine/providers/AssetServiceProvider.js';
import { DatabaseServiceProvider } from '../engine/providers/DatabaseServiceProvider.js';
import { AuthServiceProvider } from '../engine/providers/AuthServiceProvider.js';
import { ValidationServiceProvider } from '../engine/providers/ValidationServiceProvider.js';
import { LoggingServiceProvider } from '../engine/providers/LoggingServiceProvider.js';
import { EventServiceProvider } from '../engine/providers/EventServiceProvider.js';
import { CacheServiceProvider } from '../engine/providers/CacheServiceProvider.js';
import { MailServiceProvider } from '../engine/providers/MailServiceProvider.js';
import { QueueServiceProvider } from '../engine/providers/QueueServiceProvider.js';
import { RedisServiceProvider } from '../engine/providers/RedisServiceProvider.js';
import { StorageServiceProvider } from '../engine/providers/StorageServiceProvider.js';
import { ScheduleServiceProvider } from '../engine/providers/ScheduleServiceProvider.js';

const basePath = resolveProjectRoot(import.meta.url);

export const app = Application.configure({ basePath })
  .withRouting(routesFilePath(basePath))
  .withProviders(
    MiddlewareServiceProvider,
    AppServiceProvider,
    LoggingServiceProvider,
    EventServiceProvider,
    RedisServiceProvider,
    CacheServiceProvider,
    MailServiceProvider,
    QueueServiceProvider,
    StorageServiceProvider,
    ScheduleServiceProvider,
    ViewServiceProvider,
    AssetServiceProvider,
    DatabaseServiceProvider,
    AuthServiceProvider,
    ValidationServiceProvider,
    ControllerServiceProvider,
  );
