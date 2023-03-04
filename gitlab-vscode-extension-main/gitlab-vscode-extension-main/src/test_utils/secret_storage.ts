export class SecretStorage {
  #secrets: Record<string, string> = {};

  async store(key: string, value: string) {
    this.#secrets[key] = value;
  }

  async get(key: string) {
    return this.#secrets[key];
  }
}
