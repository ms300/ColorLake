import ProcessorWorker from '../workers/imageProcessor.worker?worker';
import type { ProcessorResponse } from '../workers/imageProcessor.worker';
import type { UploadedImage } from '../types';

type JobCallback = (error: string | null, result?: UploadedImage) => void;

class ImageProcessor {
  private worker: Worker;
  private jobs: Map<string, { file: File, callback: JobCallback }> = new Map();

  constructor() {
    this.worker = new ProcessorWorker();
    this.worker.onmessage = this.handleMessage.bind(this);
  }

  private handleMessage(e: MessageEvent<ProcessorResponse>) {
    const { type, id } = e.data;
    const job = this.jobs.get(id);

    if (!job) return;

    if (type === 'SUCCESS') {
      const { originalWidth, originalHeight, previewWidth, previewHeight, previewBlob } = e.data;
      const { file } = job;
      
      const originalUrl = URL.createObjectURL(file);
      const previewUrl = previewBlob ? URL.createObjectURL(previewBlob) : originalUrl;
      const sizeLabel = `${Math.round(file.size / 1024)} KB`;

      const result: UploadedImage = {
        id, // Use the job ID as the image ID
        name: file.name,
        originalFile: file,
        originalUrl,
        previewUrl,
        originalWidth,
        originalHeight,
        previewWidth,
        previewHeight,
        sizeLabel
      };

      job.callback(null, result);
    } else {
      job.callback(e.data.error);
    }

    this.jobs.delete(id);
  }

  public process(file: File, id: string, callback: JobCallback) {
    this.jobs.set(id, { file, callback });
    this.worker.postMessage({ file, id });
  }
}

export const imageProcessor = new ImageProcessor();
