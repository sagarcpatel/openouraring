import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
  const bucket = platform?.env?.OURA_DATA;
  const userId = sanitizeIdentifier(url.searchParams.get('userId'));
  let uploadId = sanitizeIdentifier(url.searchParams.get('uploadId'));

  if (!bucket) {
    return json({ error: 'R2 binding OURA_DATA is not configured.' }, { status: 500 });
  }

  if (!userId) {
    return json({ error: 'Missing or invalid userId.' }, { status: 400 });
  }

  if (!uploadId) {
    const indexObject = await bucket.get(`users/${userId}/index.json`);
    if (!indexObject) {
      return json({ error: 'No uploads found for this user.' }, { status: 404 });
    }

    const index = (await indexObject.json()) as { latestUploadId?: string };
    uploadId = sanitizeIdentifier(index.latestUploadId);
  }

  if (!uploadId) {
    return json({ error: 'Missing or invalid uploadId.' }, { status: 400 });
  }

  const summaryKey = `users/${userId}/exports/${uploadId}/summary.json`;
  const summaryObject = await bucket.get(summaryKey);

  if (!summaryObject) {
    return json({ error: 'Dataset summary was not found.' }, { status: 404 });
  }

  return json(await summaryObject.json());
};

function sanitizeIdentifier(value: string | null | undefined) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(trimmed)) return null;
  return trimmed;
}
