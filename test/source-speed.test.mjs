import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { onRequest } from '../functions/proxy/[[path]].js';

const rootDir = path.resolve(import.meta.dirname, '..');

async function loadSourceSpeed(fetchImpl) {
  const window = { ProxyAuth: { addAuthToProxyUrl: async url => `${url}?auth=test-hash` } };
  const sandbox = {
    window, URL, AbortController, DOMException, TextDecoder, performance, setTimeout, clearTimeout,
    fetch: fetchImpl
  };
  vm.createContext(sandbox);
  vm.runInContext(await readFile(path.join(rootDir, 'js/source-speed.js'), 'utf8'), sandbox);
  return window.SourceSpeed;
}

function parseRequest(url, options) {
  const parsed = new URL(url, 'https://libretv.example');
  const viaProxy = parsed.pathname.startsWith('/proxy/');
  return {
    target: viaProxy ? decodeURIComponent(parsed.pathname.slice('/proxy/'.length)) : parsed.toString(),
    transport: viaProxy ? 'proxy' : 'direct',
    probe: parsed.searchParams.get('probe'),
    range: options?.headers?.Range || null
  };
}

function longMediaPlaylist(segmentCount, prefix = '') {
  let text = '#EXTM3U\n#EXT-X-TARGETDURATION:6\n';
  for (let i = 0; i < segmentCount; i++) text += `#EXTINF:6.000,\n${prefix}seg-${String(i).padStart(5, '0')}-a-fairly-long-segment-name.ts\n`;
  return text + '#EXT-X-ENDLIST\n';
}

test('source speed reads the whole playlist, samples an early segment and uses the master bitrate', async () => {
  const requests = [];
  const mediaPlaylist = longMediaPlaylist(2000);
  assert.ok(mediaPlaylist.length > 64 * 1024, 'playlist must exceed the old 64 KiB sample');
  const SourceSpeed = await loadSourceSpeed(async (url, options) => {
    const request = parseRequest(url, options);
    requests.push(request);
    if (request.target.endsWith('master.m3u8')) {
      return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nlow/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=4000000\nhigh/index.m3u8\n', {
        headers: { 'Content-Type': 'application/vnd.apple.mpegurl' }
      });
    }
    if (request.target.endsWith('index.m3u8')) {
      return new Response(mediaPlaylist, { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } });
    }
    return new Response(new Uint8Array(512 * 1024), { headers: { 'Content-Type': 'video/mp2t' } });
  });

  const result = await SourceSpeed.probeEpisodeUrl('https://media.example/master.m3u8');
  assert.deepEqual(requests.map(request => [request.target, request.transport]), [
    ['https://media.example/master.m3u8', 'direct'],
    ['https://media.example/high/index.m3u8', 'direct'],
    ['https://media.example/high/seg-00002-a-fairly-long-segment-name.ts', 'direct']
  ]);
  assert.equal(result.bytes, 512 * 1024);
  assert.equal(result.transport, 'direct');
  assert.equal(result.bitrateKbps, 4000);
  assert.ok(result.kbps > 0);
  assert.ok(result.latencyMs >= 1);
  assert.ok(['smooth', 'ok', 'slow'].includes(result.verdict));
  const described = SourceSpeed.describeResult(result);
  assert.match(described.label, /(KB|MB)\/s · (流畅|较流畅|可能卡顿)/);
  assert.match(described.title, /视频码率 4\.0 Mbps/);
});

test('source speed estimates bitrate from segment size and duration without a master playlist', async () => {
  const SourceSpeed = await loadSourceSpeed(async (url, options) => {
    const request = parseRequest(url, options);
    if (request.target.endsWith('.m3u8')) {
      return new Response(longMediaPlaylist(5), { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } });
    }
    return new Response(new Uint8Array(300 * 1024), {
      headers: { 'Content-Type': 'video/mp2t', 'Content-Length': String(3 * 1000 * 1000) }
    });
  });

  const result = await SourceSpeed.probeEpisodeUrl('https://media.example/index.m3u8');
  // 3 MB over a 6 second segment is 4 Mbps.
  assert.equal(result.bitrateKbps, 4000);
});

test('source speed uses the byte-range length, not the shared file size, for byte-range playlists', async () => {
  const playlist = '#EXTM3U\n#EXT-X-VERSION:4\n' +
    [0, 1, 2, 3].map(i => `#EXTINF:6.0,\n#EXT-X-BYTERANGE:3000000@${i * 3000000}\nmovie.ts\n`).join('') +
    '#EXT-X-ENDLIST\n';
  const SourceSpeed = await loadSourceSpeed(async (url, options) => {
    const request = parseRequest(url, options);
    if (request.target.endsWith('.m3u8')) {
      return new Response(playlist, { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } });
    }
    // The whole movie file is far larger than one segment.
    return new Response(new Uint8Array(300 * 1024), {
      headers: { 'Content-Type': 'video/mp2t', 'Content-Length': String(2 * 1000 * 1000 * 1000) }
    });
  });

  const result = await SourceSpeed.probeEpisodeUrl('https://media.example/index.m3u8');
  // 3 MB over 6 seconds is 4 Mbps; the 2 GB file size must not be used.
  assert.equal(result.bitrateKbps, 4000);
});

test('source speed follows a media-looking URL that serves an HLS playlist', async () => {
  const requests = [];
  const SourceSpeed = await loadSourceSpeed(async (url, options) => {
    const request = parseRequest(url, options);
    requests.push(request.target);
    if (request.target.endsWith('/play.mp4') || request.target.endsWith('.m3u8')) {
      // Larger than 1 KiB so it would pass as a bogus media sample if treated as one.
      return new Response(longMediaPlaylist(100), { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } });
    }
    return new Response(new Uint8Array(200 * 1024), { headers: { 'Content-Type': 'video/mp2t' } });
  });

  const result = await SourceSpeed.probeEpisodeUrl('https://media.example/play.mp4');
  assert.equal(result.bytes, 200 * 1024);
  assert.equal(requests.at(-1), 'https://media.example/seg-00002-a-fairly-long-segment-name.ts');
});

test('source speed falls back to the authenticated proxy when direct media cannot be read', async () => {
  const requests = [];
  const SourceSpeed = await loadSourceSpeed(async (url, options) => {
    const request = parseRequest(url, options);
    requests.push(request);
    if (request.transport === 'direct') throw new TypeError('Failed to fetch');
    if (request.target.endsWith('.m3u8')) {
      // The regular proxy rewrites playlist entries to proxy paths.
      const rewritten = longMediaPlaylist(4, '').replace(/^(seg-.+\.ts)$/gm,
        line => `/proxy/${encodeURIComponent(`https://cdn.example/path/${line}`)}`);
      return new Response(rewritten, { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } });
    }
    return new Response(new Uint8Array(200 * 1024), {
      status: 206, headers: { 'Content-Type': 'video/mp2t' }
    });
  });

  const result = await SourceSpeed.probeEpisodeUrl('https://media.example/index.m3u8');
  assert.equal(result.transport, 'proxy');
  assert.deepEqual(requests.map(request => request.transport), ['direct', 'proxy', 'direct', 'proxy']);
  // Playlists use the regular proxy without a range so they arrive complete.
  assert.equal(requests[1].probe, null);
  assert.equal(requests[1].range, null);
  // Segments use the streaming range probe.
  assert.equal(requests[3].target, 'https://cdn.example/path/seg-00002-a-fairly-long-segment-name.ts');
  assert.equal(requests[3].probe, '1');
  assert.equal(requests[3].range, 'bytes=0-2097151');
  assert.match(SourceSpeed.describeResult(result).label, /^代理 /);
});

test('source speed downloads media samples one source at a time', async () => {
  let active = 0;
  let maxActive = 0;
  const SourceSpeed = await loadSourceSpeed(async (url, options) => {
    const request = parseRequest(url, options);
    if (request.target.endsWith('.m3u8')) {
      return new Response(longMediaPlaylist(3), { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } });
    }
    active += 1;
    maxActive = Math.max(maxActive, active);
    let sent = 0;
    const body = new ReadableStream({
      async pull(controller) {
        await new Promise(resolve => setTimeout(resolve, 5));
        if (sent >= 4) {
          active -= 1;
          controller.close();
          return;
        }
        sent += 1;
        controller.enqueue(new Uint8Array(32 * 1024));
      },
      cancel() { active -= 1; }
    });
    return new Response(body, { headers: { 'Content-Type': 'video/mp2t' } });
  });

  const results = await Promise.all([
    SourceSpeed.probeEpisodeUrl('https://a.example/index.m3u8'),
    SourceSpeed.probeEpisodeUrl('https://b.example/index.m3u8'),
    SourceSpeed.probeEpisodeUrl('https://c.example/index.m3u8')
  ]);
  assert.equal(results.length, 3);
  assert.equal(maxActive, 1);
});

test('source speed ranks smooth sources above faster but stuttering ones', async () => {
  const SourceSpeed = await loadSourceSpeed(async () => { throw new Error('unused'); });
  const smooth = { kbps: 900, latencyMs: 80, verdict: 'smooth' };
  const slow = { kbps: 2000, latencyMs: 40, verdict: 'slow' };
  assert.ok(SourceSpeed.scoreResult(smooth) > SourceSpeed.scoreResult(slow));
  assert.equal(SourceSpeed.scoreResult(null), -1);
});

test('Cloudflare proxy streams authorized range probes up to 2 MiB without caching', async () => {
  const target = 'https://media.example/segment.ts';
  const password = 'test-password';
  const auth = createHash('sha256').update(password).digest('hex');
  const makeRequest = range => new Request(`https://libretv.example/proxy/${encodeURIComponent(target)}?auth=${auth}&probe=1`, {
    headers: { Range: range }
  });
  const originalFetch = globalThis.fetch;
  let upstreamRange;
  globalThis.fetch = async (_url, options) => {
    upstreamRange = options.headers.get('Range');
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 206,
      headers: { 'Content-Type': 'video/mp2t', 'Content-Range': 'bytes 0-2/1000' }
    });
  };
  try {
    const response = await onRequest({ request: makeRequest('bytes=0-2097151'), env: { PASSWORD: password }, waitUntil() {} });
    assert.equal(upstreamRange, 'bytes=0-2097151');
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Content-Range'), 'bytes 0-2/1000');
    assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())), [1, 2, 3]);

    const tooLarge = await onRequest({ request: makeRequest('bytes=0-2097152'), env: { PASSWORD: password }, waitUntil() {} });
    assert.equal(tooLarge.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('HLS master resolution is reported before media sampling and is not inferred from speed', async () => {
  const requests=[];
  let reported;
  const source=await loadSourceSpeed(async (url,options)=>{
    const {target}=parseRequest(url,options);
    requests.push(target);
    if(target.endsWith('master.m3u8'))return new Response(
      '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=950000,RESOLUTION=640x360\nlow.m3u8\n' +
      '#EXT-X-STREAM-INF:BANDWIDTH=3800000,RESOLUTION=1920x816\nhi.m3u8\n',
      {headers:{'Content-Type':'application/vnd.apple.mpegurl'}});
    if(target.endsWith('hi.m3u8'))return new Response(longMediaPlaylist(5),{
      headers:{'Content-Type':'application/vnd.apple.mpegurl'}
    });
    return new Response(new Uint8Array(128*1024),{headers:{'Content-Type':'video/mp2t'}});
  });
  const result=await source.probeEpisodeUrl('https://cdn.example/master.m3u8',{
    onPlaylistInfo:res=>{
      assert.equal(requests.length,2,'resolution should appear before segment download');
      reported=res;
    }
  });
  assert.deepEqual({...reported},{width:1920,height:816});
  assert.deepEqual({...result.resolution},{width:1920,height:816});
  assert.equal(result.bitrateKbps,3800);
});

test('no HLS RESOLUTION metadata must remain unknown even with a high speed score',async()=>{
  const source=await loadSourceSpeed(async (url,options)=>{
    const {target}=parseRequest(url,options);
    if(target.endsWith('.m3u8'))return new Response(longMediaPlaylist(3),{
      headers:{'Content-Type':'application/vnd.apple.mpegurl'}
    });
    return new Response(new Uint8Array(256*1024),{headers:{'Content-Type':'video/mp2t'}});
  });
  let callbackCount=0;
  const result=await source.probeEpisodeUrl('https://cdn.example/movie.m3u8',{
    onPlaylistInfo:()=>callbackCount++
  });
  assert.equal(result.resolution,null);
  assert.equal(callbackCount,0);
  assert.ok(result.kbps>0);
});

test('nested HLS master uses the selected innermost manifest resolution',async()=>{
  const source=await loadSourceSpeed(async (url,options)=>{
    const {target}=parseRequest(url,options);
    if(target.endsWith('/outer.m3u8'))return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080\ninner.m3u8\n',{headers:{'Content-Type':'application/vnd.apple.mpegurl'}});
    if(target.endsWith('/inner.m3u8'))return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720\nreal.m3u8\n',{headers:{'Content-Type':'application/vnd.apple.mpegurl'}});
    if(target.endsWith('/real.m3u8'))return new Response(longMediaPlaylist(3),{headers:{'Content-Type':'application/vnd.apple.mpegurl'}});
    return new Response(new Uint8Array(192*1024),{headers:{'Content-Type':'video/mp2t'}});
  });
  const r=await source.probeEpisodeUrl('https://cdn.example/outer.m3u8');
  assert.deepEqual({...r.resolution},{width:1280,height:720});
});


test('switch UI distinguishes real decoded size from unplayed manifest metadata', async()=>{
  const source=await readFile(path.join(rootDir,'js/player.js'),'utf8');
  const css=await readFile(path.join(rootDir,'css/player.css'),'utf8');
  assert.match(source,/data-resolution-badge/);
  assert.match(source,/清单声明/);
  assert.match(source,/实际解码/);
  assert.match(source,/media\.videoWidth/);
  assert.match(source,/media\.videoHeight/);
  assert.match(source,/addEventListener\('resize', updateDecodedResolution/);
  assert.match(source,/onPlaylistInfo/);
  assert.match(css,/resource-resolution\[data-type="decoded"\]/);
});
