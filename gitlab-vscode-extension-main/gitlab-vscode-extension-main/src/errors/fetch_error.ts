import { stackToArray, DetailedError } from './common';

export class FetchError extends Error implements DetailedError {
  response: Response;

  #body?: string;

  constructor(message: string, response: Response, body?: string) {
    super(message);
    this.response = response;
    this.#body = body;
  }

  get status() {
    return this.response.status;
  }

  get details() {
    const { message, stack } = this;
    return {
      message,
      stack: stackToArray(stack),
      response: {
        status: this.response.status,
        headers: this.response.headers,
        body: this.#body,
      },
    };
  }
}
