import { Response } from '../engine/http/Response.js';

function reply() {
  return reply;
}

reply.json = (data, status = 200) => Response.json(data, status);
reply.html = (content, status = 200) => Response.html(content, status);
reply.text = (content, status = 200) => Response.text(content, status);
reply.notFound = (message) => Response.notFound(message);
reply.error = (message, status = 500) => Response.error(message, status);

export default reply;
