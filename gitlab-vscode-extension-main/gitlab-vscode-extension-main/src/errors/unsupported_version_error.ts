export class UnsupportedVersionError extends Error {
  private feature: string;

  private currentVersion: string;

  private requiredVersion: string;

  constructor(feature: string, currentVersion: string, requiredVersion: string) {
    super();
    this.feature = feature;
    this.currentVersion = currentVersion;
    this.requiredVersion = requiredVersion;
  }

  get message() {
    return `The feature "${this.feature}" is unsupported in GitLab version (${this.currentVersion}). To use ${this.feature}, upgrade to GitLab version ${this.requiredVersion} or later.`;
  }
}
