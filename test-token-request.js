const clientId = process.env.VITE_ENTRA_CLIENT_ID || '';

function getApiScope() {
  return `api://${clientId}/.default`;
}

const tokenRequest = {
  scopes: clientId ? [getApiScope()] : ['openid', 'profile', 'email'],
  forceRefresh: false,
};

console.log('Client ID:', clientId);
console.log('Token Request:', JSON.stringify(tokenRequest, null, 2));
console.log('API Scope:', getApiScope());
