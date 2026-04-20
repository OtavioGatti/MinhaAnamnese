function resolveUserId(req) {
  return (
    req?.headers?.['x-user-id'] ||
    req?.body?.userId ||
    req?.query?.userId ||
    req?.ip ||
    'anonymous'
  );
}

module.exports = {
  resolveUserId,
};
