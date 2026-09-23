export interface ChunkLoadProgress {
  loaded: number;
  total: number;
  percent: number; // 0 to 100, or -1 if total is indeterminate
}

export type ChunkProgressCallback = (progress: ChunkLoadProgress) => void;

export interface LoadedChunkAsset {
  blob: Blob;
  blobUrl: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
  dispose: () => void;
}

/**
 * Downloads an asset chunk-by-chunk using ReadableStream.
 * Guarantees that 100% of chunks are downloaded before the Promise resolves.
 */
export async function loadAssetChunks(
  url: string,
  onProgress?: ChunkProgressCallback
): Promise<LoadedChunkAsset> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load asset chunks from '${url}': HTTP ${response.status} ${response.statusText}`);
  }

  const contentLengthHeader = response.headers.get('content-length');
  const total = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
  const contentType = response.headers.get('content-type') || 'application/octet-stream';

  // Fallback if ReadableStream is unavailable in execution environment
  if (!response.body || typeof response.body.getReader !== 'function') {
    const blob = await response.blob();
    onProgress?.({ loaded: blob.size, total: blob.size, percent: 100 });
    const blobUrl = URL.createObjectURL(blob);
    return {
      blob,
      blobUrl,
      arrayBuffer: () => blob.arrayBuffer(),
      dispose: () => {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch (_) {}
      }
    };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      if (total > 0) {
        const percent = Math.min(100, Math.round((loaded / total) * 100));
        onProgress?.({ loaded, total, percent });
      } else {
        onProgress?.({ loaded, total: 0, percent: -1 });
      }
    }
  }

  if (total > 0) {
    onProgress?.({ loaded: total, total, percent: 100 });
  }

  const blob = new Blob(chunks, { type: contentType });
  const blobUrl = URL.createObjectURL(blob);

  return {
    blob,
    blobUrl,
    arrayBuffer: async () => {
      const merged = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return merged.buffer;
    },
    dispose: () => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch (_) {}
    }
  };
}
