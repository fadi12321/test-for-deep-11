/* This is an in-memory implementation of the VS Code globalState */
export class InMemoryMemento {
  state: Record<string, any>;

  constructor() {
    this.state = {};
  }

  update(key: string, value: any) {
    this.state[key] = value;
  }

  get(key: string, defaultValue: any) {
    return this.state[key] || defaultValue;
  }
}
