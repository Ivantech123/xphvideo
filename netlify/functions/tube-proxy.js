const ALLOWED_HOSTS = new Set([
  'pornhub.com',
  'www.pornhub.com',
  'xvideos.com',
  'www.xvideos.com',
  'eporner.com',
  'www.eporner.com'
]);

const isAllowedHost = (host) => ALLOWED_HOSTS.has(host);

const BASE_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  accept: '*/*',
  'accept-language': 'en-US,en;q=0.9'
};

export const handler = async (event) => {
  if (event.httpMethod && event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const urlParam = event.queryStringParameters?.url;
  if (!urlParam) {
    return { statusCode: 400, body: 'Missing url' };
  }

  let target;
  try {
    target = new URL(urlParam);
  } catch {
    return { statusCode: 400, body: 'Invalid url' };
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    return { statusCode: 400, body: 'Invalid protocol' };
  }

  if (!isAllowedHost(target.hostname)) {
    return { statusCode: 403, body: 'Host not allowed' };
  }

  try {
    const res = await fetch(target.toString(), { headers: BASE_HEADERS });
    const text = await res.text();
    return {
      statusCode: res.status,
      headers: {
        'access-control-allow-origin': '*',
        'content-type': res.headers.get('content-type') || 'text/plain; charset=utf-8',
        'cache-control': 'no-store'
      },
      body: text
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'access-control-allow-origin': '*' },
      body: error instanceof Error ? error.message : 'Upstream error'
    };
  }
};
