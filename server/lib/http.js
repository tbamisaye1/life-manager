/** Consistent JSON error helper: res.status(400).json(httpError('bad', 'BAD')) */
export function httpError(message, code = 'ERROR') {
  return { error: { message, code } }
}

/** Wrap an async route handler so thrown errors become clean 500s. */
export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

/** Express error middleware — last in the chain. */
export function errorMiddleware(err, _req, res, _next) {
  console.error('[api error]', err.message)
  const status = err.status || 500
  res.status(status).json(httpError(err.message || 'Internal error', err.code || 'INTERNAL'))
}
