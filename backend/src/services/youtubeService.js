import { config, hasYoutubeKey } from '../config/index.js';

export async function searchYoutube(query, maxResults = 3) {
  if (!hasYoutubeKey()) return [];

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: String(maxResults),
    q: query,
    safeSearch: 'moderate',
    key: config.youtube.apiKey,
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.warn('[yt] search failed:', res.status, detail.slice(0, 200));
    return [];
  }

  const data = await res.json();
  return (data.items || [])
    .filter((it) => it?.id?.videoId)
    .map((it) => ({
      id: it.id.videoId,
      title: it.snippet?.title || '',
      channel: it.snippet?.channelTitle || '',
      url: `https://www.youtube.com/watch?v=${it.id.videoId}`,
      thumbnail: it.snippet?.thumbnails?.medium?.url || '',
    }));
}
