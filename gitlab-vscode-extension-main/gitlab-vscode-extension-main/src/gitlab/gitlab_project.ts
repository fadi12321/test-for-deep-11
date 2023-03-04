import { getRestIdFromGraphQLId } from './get_rest_id_from_graphql_id';
import { GqlProject } from './graphql/shared';

export class GitLabProject {
  #gqlProject: GqlProject;

  constructor(gqlProject: GqlProject) {
    this.#gqlProject = gqlProject;
  }

  get gqlId(): string {
    return this.#gqlProject.id;
  }

  get restId(): number {
    return getRestIdFromGraphQLId(this.#gqlProject.id);
  }

  get name(): string {
    return this.#gqlProject.name;
  }

  get description(): string {
    return this.#gqlProject.description;
  }

  get httpUrlToRepo(): string {
    return this.#gqlProject.httpUrlToRepo;
  }

  get sshUrlToRepo(): string {
    return this.#gqlProject.sshUrlToRepo;
  }

  get namespaceWithPath(): string {
    return this.#gqlProject.fullPath;
  }

  get webUrl(): string {
    return this.#gqlProject.webUrl;
  }

  get groupRestId(): number | undefined {
    return this.#gqlProject.group && getRestIdFromGraphQLId(this.#gqlProject.group.id);
  }

  get wikiEnabled(): boolean {
    return this.#gqlProject.wikiEnabled;
  }

  get empty(): boolean {
    return Boolean(this.#gqlProject.repository?.empty);
  }

  get rootRef(): string | undefined {
    return this.#gqlProject.repository?.rootRef;
  }
}
