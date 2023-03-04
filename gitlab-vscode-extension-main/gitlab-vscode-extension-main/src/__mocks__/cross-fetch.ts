export const DEFAULT_FETCH_RESPONSE = '# Fabulous Project\n\nThis project does fabulous things.';
const DEFAULT_JSON_RESPONSE = {
  name: 'Fabulous Project',
  description: 'This project does fabulous things.',
};

const fn = jest.fn().mockResolvedValue({
  ok: true,
  async text() {
    return DEFAULT_FETCH_RESPONSE;
  },
  async json() {
    return DEFAULT_JSON_RESPONSE;
  },
});
export default fn;
