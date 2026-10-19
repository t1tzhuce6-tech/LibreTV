/* Optional Windows PotPlayer hand-off. No playback is initiated except on an explicit click. */
(function (root) {
    'use strict';

    function isWindows() {
        return /Windows/i.test(String(root.navigator?.userAgent || ''));
    }

    function directMediaUrl(value) {
        if (typeof value !== 'string' || value.length > 4096) return null;
        try {
            const u = new URL(value.trim());
            if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) return null;
            const host = u.hostname.toLowerCase();
            if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
                /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
                /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) || host.includes(':')) return null;
            if (!/\.(?:m3u8|mp4|webm|mov|m4v|ts|mkv|flv)$/i.test(u.pathname)) return null;
            return u.href;
        } catch { return null; }
    }

    function protocolUrl(value) {
        const url = directMediaUrl(value);
        if (!url) return null;
        // Only this previously verified CDN goes through the local, loopback-only HLS relay.
        // All other media URLs retain their original PotPlayer hand-off path.
        const parsed = new URL(url);
        if (parsed.hostname.toLowerCase() === 'play.maoyanplay.top' && parsed.pathname.endsWith('.m3u8')) {
            const token = root.btoa(url).split('+').join('-').split('/').join('_').replace(/=+$/, '');
            return 'potplayer://http://127.0.0.1:18755/r/' + token + '/stream.m3u8';
        }
        return 'potplayer://' + url;
    }

    function launch(value) {
        if (!isWindows()) return { ok: false, reason: 'windows_only' };
        const href = protocolUrl(value);
        if (!href) return { ok: false, reason: 'not_direct_media' };
        const doc = root.document;
        if (!doc?.body) return { ok: false, reason: 'no_document' };
        const a = doc.createElement('a');
        a.href = href;
        a.style.display = 'none';
        a.setAttribute('aria-hidden', 'true');
        doc.body.appendChild(a);
        try { a.click(); } finally { a.remove(); }
        // The browser controls the permission prompt; web code cannot confirm PotPlayer launched.
        return { ok: true, reason: 'browser_handoff_requested' };
    }

    root.LibreExternalPlayer = Object.freeze({ isWindows, directMediaUrl, protocolUrl, launch });
})(typeof window !== 'undefined' ? window : globalThis);
