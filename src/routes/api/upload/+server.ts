import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseOuraZip } from '$lib/oura/parse';

const MAX_UPLOAD_BYTES = 75 * 1024 * 1024;

export const POST: RequestHandler = async ({ request, platform }) => {
  const bucket = platform?.env?.OURA_DATA;

  if (!bucket) {
    return json({ error: 'R2 binding OURA_DATA is not configured.' }, { status: 500 });
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES) {
    return json({ error: 'Upload is too large. Keep Oura exports under 75 MB.' }, { status: 413 });
  }

  const form = await request.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return json({ error: 'Attach an Oura data.zip file in the file field.' }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith('.zip')) {
    return json({ error: 'Only .zip Oura exports are supported.' }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return json({ error: 'Upload is too large. Keep Oura exports under 75 MB.' }, { status: 413 });
  }

  const suppliedUserId = sanitizeIdentifier(form.get('userId'));
  const userId = suppliedUserId ?? crypto.randomUUID();
  const uploadId = crypto.randomUUID();
  const uploadedAt = new Date().toISOString();
  const rawZipKey = `users/${userId}/exports/${uploadId}/data.zip`;
  const summaryKey = `users/${userId}/exports/${uploadId}/summary.json`;
  const indexKey = `users/${userId}/index.json`;
  const bytes = await file.arrayBuffer();
  const summary = await parseOuraZip(bytes, { sourceName: file.name });

  summary.storage = {
    userId,
    uploadId,
    rawZipKey,
    summaryKey,
    uploadedAt
  };

  await bucket.put(rawZipKey, bytes, {
    httpMetadata: {
      contentType: 'application/zip'
    },
    customMetadata: {
      userId,
      uploadId,
      uploadedAt,
      originalName: file.name
    }
  });

  await bucket.put(summaryKey, JSON.stringify(summary), {
    httpMetadata: {
      contentType: 'application/json'
    },
    customMetadata: {
      userId,
      uploadId,
      uploadedAt,
      kind: 'summary'
    }
  });

  await bucket.put(
    indexKey,
    JSON.stringify({
      userId,
      latestUploadId: uploadId,
      latestSummaryKey: summaryKey,
      updatedAt: uploadedAt
    }),
    {
      httpMetadata: {
        contentType: 'application/json'
      }
    }
  );

  return json({
    userId,
    uploadId,
    path: `users/${userId}/exports/${uploadId}/`,
    summary
  });
};

function sanitizeIdentifier(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(trimmed)) return null;
  return trimmed;
}
