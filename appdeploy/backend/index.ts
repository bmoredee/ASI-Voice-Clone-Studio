import {
  router,
  json,
  error,
  requireAuth,
  requireAdminEmailAllowlist,
  storage,
  secrets,
} from '@appdeploy/sdk';

const ADMIN_EMAILS = ['digjy.com@gmail.com'];
const MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  opus: 'audio/opus',
  aiff: 'audio/aiff',
  wma: 'audio/x-ms-wma',
};
const MAX_BYTES = 12 * 1024 * 1024;

async function engineConfig(): Promise<{ url: string; token: string } | null> {
  const names = await secrets.listSecretNames();
  if (
    !names.includes('VOICE_ENGINE_URL') ||
    !names.includes('VOICE_ENGINE_TOKEN')
  )
    return null;
  const raw = (await secrets.readSecret('VOICE_ENGINE_URL'))
    .trim()
    .replace(/\/+$/, '');
  const token = (await secrets.readSecret('VOICE_ENGINE_TOKEN')).trim();
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      token.length < 24 ||
      url.username || url.password || url.search || url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    ) return null;
    return { url: url.toString().replace(/\/+$/, ''), token };
  } catch {
    return null;
  }
}
function validId(id: string) {
  return /^[0-9a-f-]{32,36}$/i.test(id);
}
function validName(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return name.length <= 180 && /^[\w. ()-]+$/.test(name) && Boolean(MIME[ext]);
}
function getType(name: string) {
  return (
    MIME[name.split('.').pop()?.toLowerCase() || ''] ||
    'application/octet-stream'
  );
}
function uploadPath(user: string, upload: string, kind: string, index: number) {
  return 'uploads/' + user + '/' + upload + '/' + kind + '/' + index;
}
function jobPath(user: string, id: string) {
  return 'jobs/' + user + '/' + id + '.json';
}
async function remoteRequest(
  config: { url: string; token: string },
  path: string,
  init?: RequestInit
) {
  const h = new Headers(init?.headers);
  h.set('Authorization', 'Bearer ' + config.token);
  const response = await fetch(config.url + path, {
    ...init,
    headers: h,
    signal: AbortSignal.timeout(path === '/api/health' ? 7000 : 30000),
  });
  return response;
}
async function readJob(user: string, id: string) {
  const [entry] = await storage.read([jobPath(user, id)]);
  if (!entry?.content) return null;
  return JSON.parse(entry.content) as { remoteId: string; createdAt: string };
}
async function audioFromChunks(
  user: string,
  uploadId: string,
  kind: string,
  count: number
) {
  if (!Number.isInteger(count) || count < 1 || count > 24)
    throw new Error('Invalid audio part count');
  const paths = Array.from({ length: count }, (_, i) =>
    uploadPath(user, uploadId, kind, i)
  );
  const items = await storage.read(paths);
  if (items.length !== count || items.some(x => !x.content))
    throw new Error('Missing audio chunks. Upload again.');
  const buffers = items.map(item => {
    const binary = atob(item.content!);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  });
  const total = buffers.reduce((sum, bytes) => sum + bytes.length, 0);
  if (total === 0 || total > MAX_BYTES)
    throw new Error('Audio must be smaller than 12 MB.');
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const bytes of buffers) {
    joined.set(bytes, offset);
    offset += bytes.length;
  }
  return { bytes: joined, paths };
}
const guarded = [requireAuth(), requireAdminEmailAllowlist(ADMIN_EMAILS)];

export const handler = router({
  'GET /api/_healthcheck': [
    async () => json({ status: 'ok', app: 'ASI Voice Clone Studio' }),
  ],
  'GET /api/engine-status': [
    ...guarded,
    async () => {
      const config = await engineConfig();
      if (!config) return json({
        connected: false, configured: false, model: 'ChatterboxVC',
        gpuRequired: true, apiFee: false,
        status: 'GPU endpoint and credentials required',
      });
      try {
        const response = await remoteRequest(config, '/api/health');
        if (!response.ok) return json({
          connected: false, configured: true, model: 'ChatterboxVC',
          gpuRequired: true, apiFee: false,
          status: 'GPU endpoint did not pass health checks',
        });
        const data = await response.json() as { ready?: boolean; engine?: string; model_loaded?: boolean };
        const connected = data.ready === true && data.engine === 'ChatterboxVC';
        return json({ connected, configured: true, model: 'ChatterboxVC',
          gpuRequired: true, apiFee: false,
          modelLoaded: data.model_loaded === true,
          status: connected ? 'GPU API healthy' : 'GPU engine not ready',
        });
      } catch {
        return json({ connected: false, configured: true,
          model: 'ChatterboxVC', gpuRequired: true, apiFee: false,
          status: 'GPU endpoint unreachable',
        });
      }
    },
  ],
  'POST /api/upload-part': [
    ...guarded,
    async ({ user, body }) => {
      const b = body as Record<string, unknown>;
      const id = String(b?.uploadId || '');
      const kind = String(b?.kind || '');
      const index = Number(b?.index);
      const total = Number(b?.total);
      const content = String(b?.content || '');
      if (
        !validId(id) ||
        !['source', 'target'].includes(kind) ||
        !Number.isInteger(index) ||
        !Number.isInteger(total) ||
        total < 1 ||
        total > 24 ||
        index < 0 ||
        index >= total ||
        content.length < 20 ||
        content.length > 1050000 ||
        !/^[A-Za-z0-9+/=]+$/.test(content)
      )
        return error('Invalid audio upload chunk', 400);
      const [ok] = await storage.write([
        {
          path: uploadPath(user!.userId, id, kind, index),
          content,
          contentType: 'application/octet-stream',
        },
      ]);
      return ok
        ? json({ ok: true, index })
        : error('Upload storage failed', 500);
    },
  ],
  'POST /api/jobs': [
    ...guarded,
    async ({ user, body }) => {
      const b = body as Record<string, unknown>;
      const uploadId = String(b?.uploadId || '');
      const srcName = String(b?.sourceName || '');
      const dstName = String(b?.targetName || '');
      if (b?.consent !== true)
        return error('Target voice permission must be confirmed', 400);
      if (!validId(uploadId) || !validName(srcName) || !validName(dstName))
        return error('Invalid audio files', 400);