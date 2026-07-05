import { Controller } from '../../engine/core/Controller.js';



export class HomeController extends Controller {

  index() {

    const config = this.app.make('config');



    return this.view('main', {

      appName: config.get('app.name', 'TaandJs'),

      version: process.env.npm_package_version ?? '0.1.0',

      env: config.get('app.env', 'local'),

    });

  }

}



export default HomeController;


