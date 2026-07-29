/**
 * Register scheduled tasks — Taand flow/console.php equivalent.
 *
 * @param {import('../../engine/schedule/ScheduleManager.js').ScheduleManager} schedule
 * @param {import('../../engine/core/Application.js').Application} app
 */
export default function defineSchedule(schedule, app) {
  // schedule.command('cache:clear').daily().name('Clear cache daily');
  // schedule.call(async () => { app.make('log').info('Heartbeat'); }).everyFiveMinutes();
}
