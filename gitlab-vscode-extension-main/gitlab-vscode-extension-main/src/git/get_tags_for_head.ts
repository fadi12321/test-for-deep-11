import { RefType, Repository } from '../api/git';

export const getTagsForHead = async (rawRepository: Repository): Promise<string[]> => {
  const tags = rawRepository.state.refs
    .filter(r => r.type === RefType.Tag && r.commit === rawRepository.state.HEAD?.commit)
    .map(r => r.name ?? '');

  return tags;
};
