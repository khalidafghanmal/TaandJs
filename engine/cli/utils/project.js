import path from 'node:path';
import { resolvetaandbasePath } from './loadApp.js';
import {
  ProjectPaths,
  controllersDir,
  handlersDir,
  inProject,
  appDir,
  jobsDir,
  listenersDir,
  mailDir,
  eventsClassDir,
  middlewareDir,
  providersDir,
} from '../../core/ProjectPaths.js';

export { handlersDir, controllersDir } from '../../core/ProjectPaths.js';

export function getProjectRoot(fromUrl = import.meta.url) {
  return resolvetaandbasePath(fromUrl);
}

/** HTTP controller output directory (src/actions). */
export function controllersPath(root, ...parts) {
  return path.join(controllersDir(root), ...parts);
}

/** @deprecated use controllersPath */
export function handlersPath(root, ...parts) {
  return controllersPath(root, ...parts);
}

/** @deprecated use controllersPath */
export function appPath(root, ...parts) {
  return controllersPath(root, ...parts);
}

export function applicationPath(root, ...parts) {
  return path.join(appDir(root), ...parts);
}

export function workersPath(root, ...parts) {
  return path.join(jobsDir(root), ...parts);
}

export function subscribersPath(root, ...parts) {
  return path.join(listenersDir(root), ...parts);
}

export function messagesPath(root, ...parts) {
  return path.join(mailDir(root), ...parts);
}

export function eventsPath(root, ...parts) {
  return path.join(eventsClassDir(root), ...parts);
}

export function middlewarePath(root, ...parts) {
  return path.join(middlewareDir(root), ...parts);
}

export function providersPath(root, ...parts) {
  return path.join(providersDir(root), ...parts);
}

export function seedsPath(root, ...parts) {
  return inProject(root, ProjectPaths.seeds, ...parts);
}
