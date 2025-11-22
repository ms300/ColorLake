import { useEffect, useState } from 'react';
import type { LUTData, LUTLoadState, LUTMeta } from '../types';
import { parseBinaryLUT } from '../utils/binaryLutParser';
import { getLUTFromDB, saveLUTToDB } from '../utils/db';

const cache = new Map<string, Promise<LUTData>>();

export async function loadLUT(meta: LUTMeta): Promise<LUTData> {
  // 1. Memory Cache
  if (cache.has(meta.id)) {
    return cache.get(meta.id)!;
  }

  // Create a promise that handles the full loading logic
  const promise = (async () => {
    try {
      // 2. IndexedDB Cache
      const cached = await getLUTFromDB(meta.id);
      // Check if cached version matches current version (hash)
      if (cached && cached.hash === meta.hash) {
        return cached;
      }

      // 3. Network Request
      const response = await fetch(encodeURI(meta.file));
      if (!response.ok) {
        throw new Error(`加载 ${meta.name} LUT 失败`);
      }
      const buffer = await response.arrayBuffer();
      const data = parseBinaryLUT(meta, buffer);

      // 4. Save to DB (fire and forget, don't block return)
      saveLUTToDB(data).catch(e => console.warn('Failed to cache LUT:', e));

      return data;
    } catch (error) {
      // If failed, remove from memory cache so we can try again later
      cache.delete(meta.id);
      throw error;
    }
  })();

  cache.set(meta.id, promise);
  return promise;
}

export function useLUTData(meta: LUTMeta | null): LUTLoadState {
  const [state, setState] = useState<LUTLoadState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    if (!meta) {
      setState({ status: 'idle' });
      return () => {
        cancelled = true;
      };
    }

    setState({ status: 'loading' });
    loadLUT(meta)
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ready', data });
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setState({ status: 'error', error: error.message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [meta?.id]);

  return state;
}
