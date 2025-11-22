import { LUTCanvasRenderer } from './webglRenderer';
import type { LUTData } from '../types';

type Task = {
  image: HTMLImageElement;
  lut: LUTData;
  resolve: (url: string) => void;
  reject: (err: unknown) => void;
};

const queue: Task[] = [];
let processing = false;
let renderer: LUTCanvasRenderer | null = null;
let canvas: HTMLCanvasElement | null = null;

async function processQueue() {
  if (processing || queue.length === 0) {
    return;
  }
  processing = true;

  try {
    if (!renderer) {
      canvas = document.createElement('canvas');
      // Initialize with a small size, it will be resized by render()
      canvas.width = 1;
      canvas.height = 1;
      renderer = new LUTCanvasRenderer(canvas);
    }

    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) {
        break;
      }

      try {
        renderer.render(task.image, task.lut);
        
        // Use toBlob to generate the image
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas?.toBlob(resolve, 'image/jpeg', 0.90);
        });

        if (blob) {
          task.resolve(URL.createObjectURL(blob));
        } else {
          task.reject(new Error('Failed to generate preview blob'));
        }
      } catch (error) {
        console.error('Preview generation error:', error);
        task.reject(error);
      }
    }
  } finally {
    processing = false;
    // If more tasks arrived while processing, continue
    if (queue.length > 0) {
      processQueue();
    }
  }
}

export function generateLUTPreview(image: HTMLImageElement, lut: LUTData): Promise<string> {
  return new Promise((resolve, reject) => {
    queue.push({ image, lut, resolve, reject });
    processQueue();
  });
}
