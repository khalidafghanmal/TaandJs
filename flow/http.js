import route from '../start/route.js';

// Module routes in src/features/*/routes.js are auto-loaded after this file (see docs/modules.md).
route.get('/', 'HomeController@index');
