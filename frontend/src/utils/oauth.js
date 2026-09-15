// Generate PKCE parameters for OAuth 2.0 security
export async function generatePKCE() {
  // Generate code_verifier (random string 43-128 chars)
  const array = crypto.getRandomValues(new Uint8Array(64));
  const codeVerifier = Array.from(array)
    .map(v => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[v % 66])
    .join('');

  // Generate code_challenge = BASE64URL(SHA256(code_verifier))
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Generate state for CSRF protection
  const state = crypto.getRandomValues(new Uint8Array(16))
    .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

  // Store securely
  sessionStorage.setItem('pkce_code_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);

  return { codeVerifier, codeChallenge, state };
}

// Get stored PKCE params
export function getStoredPKCE() {
  return {
    codeVerifier: sessionStorage.getItem('pkce_code_verifier'),
    state: sessionStorage.getItem('oauth_state')
  };
}

// Clear PKCE after use
export function clearPKCE() {
  sessionStorage.removeItem('pkce_code_verifier');
  sessionStorage.removeItem('oauth_state');
}
