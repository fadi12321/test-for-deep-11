import { stackToArray, DetailedError, isDetailedError } from './common';

export class UserFriendlyError extends Error implements DetailedError {
  originalError: Error | DetailedError;

  additionalInfo?: string;

  constructor(message: string, originalError: Error | DetailedError, additionalInfo?: string) {
    super(message);
    this.originalError = originalError;
    this.additionalInfo = additionalInfo;
  }

  get details() {
    return {
      userMessage: this.message,
      errorMessage: this.originalError.message,
      stack: stackToArray(this.originalError.stack),
      additionalInfo: this.additionalInfo,
      details: isDetailedError(this.originalError) ? this.originalError.details : undefined,
    };
  }
}
