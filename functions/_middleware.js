import { sha256 } from '../js/sha256.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const response = await next();
  const contentType = response.headers.get("content-type") || "";
  
  if (contentType.includes("text/html")) {
    let html = await response.text();
    
    // 处理普通密码
    const configuredPasswordHash = (env.PASSWORD_HASH || "").trim().toLowerCase();
    const password = env.PASSWORD || "";
    let passwordHash = "";
    if (/^[a-f0-9]{64}$/.test(configuredPasswordHash)) {
      passwordHash = configuredPasswordHash;
    } else if (password) {
      passwordHash = await sha256(password);
    }
    html = html.replace('window.__ENV__.PASSWORD = "{{PASSWORD}}";', 
      `window.__ENV__.PASSWORD = "${passwordHash}";`);
    
    // Optional public DR origin. Credentials and arbitrary redirect URLs are never injected.
    let drPublicUrl = '';
    try {
      const candidate = new URL(String(env.DR_PUBLIC_URL || '').trim());
      if (candidate.protocol === 'https:' && !candidate.username && !candidate.password && !candidate.search && !candidate.hash &&
          ['/', '/apps/drplayer', '/apps/drplayer/'].includes(candidate.pathname)) drPublicUrl = candidate.origin;
    } catch {}
    html = html.replace('window.__DR_DEFAULT_URL__ = "{{DR_PUBLIC_URL}}";',
      'window.__DR_DEFAULT_URL__ = ' + JSON.stringify(drPublicUrl) + ';');

    return new Response(html, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });
  }
  
  return response;
}
