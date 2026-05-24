export function apiFetch(url, options = {}) {
  const passcode = sessionStorage.getItem('jac_passcode') || ''
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(passcode ? { 'x-passcode': passcode } : {}),
    }
  })
}
