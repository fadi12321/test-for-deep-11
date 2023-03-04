const { setupServer } = require('msw/node');
const { rest, graphql } = require('msw');
const { API_URL_PREFIX } = require('./constants');
const projectResponse = require('../fixtures/graphql/project.json');
const versionResponse = require('../fixtures/rest/version.json');
const userResponse = require('../fixtures/rest/user.json');

const createJsonEndpoint = (path, response) =>
  rest.get(`${API_URL_PREFIX}${path}`, (req, res, ctx) => res(ctx.status(200), ctx.json(response)));

const createJsonPostEndpoint = (path, response, apiUrlPrefix = API_URL_PREFIX) =>
  rest.post(`${apiUrlPrefix}${path}`, (req, res, ctx) => res(ctx.status(200), ctx.json(response)));

const sortRequestQuery = search =>
  search
    .slice(search.indexOf('?') + 1)
    .split('&')
    .sort()
    .join('&');

const createQueryJsonEndpoint = (path, queryResponseMap) =>
  rest.get(`${API_URL_PREFIX}${path}`, (req, res, ctx) => {
    const sortedQueryResponseMap = Object.keys(queryResponseMap).reduce((acc, key) => {
      const parsedKey = new URLSearchParams(sortRequestQuery(key)).toString();
      return { ...acc, [parsedKey]: queryResponseMap[key] };
    }, {});

    const response = sortedQueryResponseMap[sortRequestQuery(req.url.search)];

    if (!response) {
      console.warn(`API call ${req.url.toString()} doesn't have a query handler.`);
      return res(ctx.status(404));
    }
    return res(ctx.status(200), ctx.json(response));
  });

const createTextEndpoint = (path, response) =>
  rest.get(`${API_URL_PREFIX}${path}`, (req, res, ctx) => res(ctx.status(200), ctx.text(response)));

const createQueryTextEndpoint = (path, queryResponseMap) =>
  rest.get(`${API_URL_PREFIX}${path}`, (req, res, ctx) => {
    const response = queryResponseMap[req.url.search];
    if (!response) {
      console.warn(`API call ${req.url.toString()} doesn't have a query handler.`);
      return res(ctx.status(404));
    }
    return res(ctx.status(200), ctx.text(response));
  });

const createPostEndpoint = (path, response) =>
  rest.post(`${API_URL_PREFIX}${path}`, (req, res, ctx) =>
    res(ctx.status(201), ctx.json(response)),
  );

const notFoundByDefault = rest.get(/.*/, (req, res, ctx) => {
  console.warn(`API call ${req.url.toString()} doesn't have a query handler.`);
  res(ctx.status(404));
});

const getServer = (handlers = []) => {
  const server = setupServer(
    graphql.query('GetProject', (req, res, ctx) => {
      if (req.variables.namespaceWithPath === 'gitlab-org/gitlab')
        return res(ctx.data(projectResponse));
      return res(ctx.data({ project: null }));
    }),
    createJsonEndpoint('/version', versionResponse),
    createJsonEndpoint('/user', userResponse),
    ...handlers,
    notFoundByDefault,
  );
  server.listen({ onUnhandledRequest: 'warn' });
  return server;
};

module.exports = {
  getServer,
  createJsonEndpoint,
  createQueryJsonEndpoint,
  createTextEndpoint,
  createQueryTextEndpoint,
  createPostEndpoint,
  createJsonPostEndpoint,
};
