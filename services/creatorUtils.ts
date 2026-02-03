import { Creator } from '../types';

const norm = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeSource = (value: unknown) => {
  const s = norm(value);
  return s || 'Unknown';
};

export const isSubscribableCreator = (creatorId: unknown, creatorName: unknown, source: unknown) => {
  const id = norm(creatorId);
  const name = norm(creatorName).toLowerCase();
  const src = normalizeSource(source).toLowerCase();

  if (!id) return false;
  if (id === 'unknown') return false;
  if (id.startsWith('src_')) return false;
  if (id.endsWith('_net') || id.endsWith('_network')) return false;

  // Common “network/source” pseudo-creators.
  if (name === 'pornhub network' || name === 'pornhub') return false;
  if (name === 'xvideos' || name === 'xvideos network') return false;
  if (name === 'eporner') return false;

  // If creator id is literally the source, treat it as non-creatable.
  if (id.toLowerCase() === src) return false;

  return true;
};

export const getSourceAvatarFallback = (source: unknown) => {
  const src = normalizeSource(source);
  if (src === 'Pornhub') return 'https://www.pornhub.com/favicon.ico';
  if (src === 'Eporner') return 'https://www.eporner.com/favicon.ico';
  if (src === 'XVideos') return 'https://www.xvideos.com/favicon.ico';
  return 'https://via.placeholder.com/80';
};

export const makeCreatorFromCatalog = (row: {
  source?: unknown;
  creator_id?: unknown;
  creator_name?: unknown;
  creator_avatar?: unknown;
}): Creator => {
  const src = normalizeSource(row.source);
  const rawId = norm(row.creator_id);
  const rawName = norm(row.creator_name);
  const rawAvatar = norm(row.creator_avatar);

  const subscribable = isSubscribableCreator(rawId, rawName, src);
  const id = rawId || `src_${src}`;
  const name = rawName || (subscribable ? id : src);
  const avatar = rawAvatar || getSourceAvatarFallback(src);

  return {
    id,
    name,
    avatar,
    verified: false,
    tier: 'Standard',
    subscribable,
  };
};

