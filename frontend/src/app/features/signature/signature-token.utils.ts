/** Consume the invitation once. The capability is never kept in browser storage or the URL. */
export function consumeSignatureToken(
  location: Pick<Location, 'hash' | 'pathname' | 'search'>,
  history: Pick<History, 'replaceState' | 'state'>,
): string | null {
  const fragment = location.hash;
  const query = new URLSearchParams(location.search);
  const queryToken = query.has('token');
  query.delete('token');
  const remainingQuery = queryToken ? (query.size ? `?${query.toString()}` : '') : location.search;
  if (fragment || queryToken)
    history.replaceState(history.state, '', location.pathname + remainingQuery);
  if (queryToken) return null;
  const parameters = new URLSearchParams(fragment.replace(/^#/, ''));
  const tokens = parameters.getAll('token');
  if (parameters.size !== 1 || tokens.length !== 1) return null;
  return /^[A-Za-z0-9_-]{43}$/.test(tokens[0]) ? tokens[0] : null;
}
