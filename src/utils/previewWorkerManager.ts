import { LUTMeta } from '../types';
import PreviewWorker from '../workers/preview.worker?worker';
import type { WorkerMessage, WorkerResponse } from '../workers/preview.worker';

type JobCallback = (error: string | null, bitmap?: ImageBitmap) => void;

class PreviewWorkerManager {
  private worker: Worker;
  private jobs: Map<string, JobCallback> = new Map();
  private currentImageId: string | null = null;

  constructor() {
    this.worker = new PreviewWorker();
    this.worker.onmessage = this.handleMessage.bind(this);
  }

  private handleMessage(e: MessageEvent<WorkerResponse>) {
    const { type, jobId } = e.data;
    const callback = this.jobs.get(jobId);

    if (!callback) return;

    if (type === 'RENDER_COMPLETE') {
      callback(null, e.data.imageBitmap);
    } else if (type === 'ERROR') {
      callback(e.data.error);
    }

    this.jobs.delete(jobId);
  }

  public async setImage(imageUrl: string, id: string, highQuality = false): Promise<void> {
    // If we already have this image loaded, check if we need to upgrade quality
    // But for simplicity, if ID matches, we assume it's fine unless we want to force reload for HQ
    // Actually, we should probably differentiate between HQ and LQ cache in worker, or just overwrite.
    // If highQuality is requested, we overwrite.
    if (this.currentImageId === id && !highQuality) return;

    // Load image and create bitmap
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    let width, height;
    
    if (highQuality) {
        // For high quality (compare view), use larger size but still limit to reasonable max (e.g. 1080p)
        // to avoid crashing worker with huge textures
        const MAX_HQ = 1920;
        const ratio = Math.min(1, MAX_HQ / Math.max(img.naturalWidth, img.naturalHeight));
        width = Math.round(img.naturalWidth * ratio);
        height = Math.round(img.naturalHeight * ratio);
    } else {
        // Create a reasonable size bitmap for thumbnails (e.g. max 300px)
        const ratio = Math.min(1, 300 / Math.max(img.naturalWidth, img.naturalHeight));
        width = Math.round(img.naturalWidth * ratio);
        height = Math.round(img.naturalHeight * ratio);
    }

    const bitmap = await createImageBitmap(img, { 
        resizeWidth: width, 
        resizeHeight: height 
    });

    const msg: WorkerMessage = {
      type: 'SET_IMAGE',
      imageBitmap: bitmap,
      id
    };

    this.worker.postMessage(msg, [bitmap]);
    this.currentImageId = id;
  }

  public renderPreview(lut: LUTMeta, imageId: string): Promise<ImageBitmap> {
    return new Promise((resolve, reject) => {
      const jobId = `${imageId}-${lut.id}-${Math.random().toString(36).slice(2)}`;
      
      this.jobs.set(jobId, (error, bitmap) => {
        if (error) reject(new Error(error));
        else resolve(bitmap!);
      });

      const msg: WorkerMessage = {
        type: 'RENDER',
        lut,
        imageId,
        jobId
      };

      this.worker.postMessage(msg);
    });
  }
}

export const previewWorkerManager = new PreviewWorkerManager();
