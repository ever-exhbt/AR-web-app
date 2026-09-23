import { describe, it, expect, vi } from 'vitest';
import { loadAssetChunks, ChunkLoadProgress } from '../src/utils/chunk-loader.js';

describe('Chunk Loader Utility', () => {
  it('streams all chunks via ReadableStream and reports progress accurately', async () => {
    const chunk1 = new Uint8Array([1, 2, 3]);
    const chunk2 = new Uint8Array([4, 5]);
    const chunk3 = new Uint8Array([6, 7, 8, 9]);
    const totalBytes = chunk1.length + chunk2.length + chunk3.length; // 9 bytes

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk1);
        controller.enqueue(chunk2);
        controller.enqueue(chunk3);
        controller.close();
      }
    });

    const mockResponse = new Response(stream, {
      status: 200,
      headers: {
        'content-length': totalBytes.toString(),
        'content-type': 'application/octet-stream'
      }
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

    const progressReports: ChunkLoadProgress[] = [];
    const asset = await loadAssetChunks('https://example.com/asset.glb', (p) => {
      progressReports.push({ ...p });
    });

    // Verify progress callbacks fired for chunks
    expect(progressReports.length).toBeGreaterThanOrEqual(3);
    const lastReport = progressReports[progressReports.length - 1];
    expect(lastReport.loaded).toBe(totalBytes);
    expect(lastReport.percent).toBe(100);

    // Verify all chunks concatenated in ArrayBuffer
    const buffer = await asset.arrayBuffer();
    const resultBytes = new Uint8Array(buffer);
    expect(resultBytes).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));

    // Verify dispose revokes blob URL
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    asset.dispose();
    expect(revokeSpy).toHaveBeenCalledWith(asset.blobUrl);

    vi.restoreAllMocks();
  });

  it('handles indeterminate content length stream without throwing', async () => {
    const chunk = new Uint8Array([10, 20, 30]);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk);
        controller.close();
      }
    });

    const mockResponse = new Response(stream, {
      status: 200,
      headers: {
        'content-type': 'video/mp4'
      }
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

    const progressReports: ChunkLoadProgress[] = [];
    const asset = await loadAssetChunks('https://example.com/stream.mp4', (p) => {
      progressReports.push({ ...p });
    });

    expect(progressReports.length).toBeGreaterThanOrEqual(1);
    expect(progressReports[0].loaded).toBe(3);
    expect(progressReports[0].percent).toBe(-1); // Indeterminate

    const buffer = await asset.arrayBuffer();
    expect(new Uint8Array(buffer)).toEqual(chunk);

    asset.dispose();
    vi.restoreAllMocks();
  });

  it('throws descriptive error when HTTP response fails', async () => {
    const mockResponse = new Response('Not Found', {
      status: 404,
      statusText: 'Not Found'
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

    await expect(loadAssetChunks('https://example.com/missing.glb')).rejects.toThrow(
      "Failed to load asset chunks from 'https://example.com/missing.glb': HTTP 404 Not Found"
    );

    vi.restoreAllMocks();
  });
});
