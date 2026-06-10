import { Response } from './Response.js';
import fs from 'node:fs';

/**
 * Stream a file from disk — used for images, audio, video, and static assets.
 */
export class FileResponse extends Response {
  constructor(filePath, status = 200, headers = {}) {
    super('', status, headers);
    this.filePath = filePath;
  }

  send(res) {
    res.writeHead(this.status, this.headers);
    fs.createReadStream(this.filePath).pipe(res);
  }
}
