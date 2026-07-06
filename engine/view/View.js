/**
 * View instance — returned by view() helper, resolved by the router.
 */
export class View {
  constructor(name, data = {}) {
    this.name = name;
    this.data = data;
  }
}

export function createViewHelper(app) {
  return function view(name, data = {}) {
    return new View(name, data);
  };
}
