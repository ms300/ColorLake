import { LUTMeta } from '../types';
import { loadLUT } from '../hooks/useLUTData';
import { LUTCanvasRenderer } from '../utils/webglRenderer';

// Define message types
export type WorkerMessage = 
  | { type: 'SET_IMAGE'; imageBitmap: ImageBitmap; id: string }
  | { type: 'RENDER'; lut: LUTMeta; imageId: string; jobId: string };

export type WorkerResponse = 
  | { type: 'RENDER_COMPLETE'; jobId: string; imageBitmap: ImageBitmap }
  | { type: 'ERROR'; jobId: string; error: string };

let currentImage: ImageBitmap | null = null;
let currentImageId: string | null = null;
let renderer: LUTCanvasRenderer | null = null;
let canvas: OffscreenCanvas | null = null;

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type === 'SET_IMAGE') {
    if (currentImage) {
      currentImage.close();
    }
    currentImage = msg.imageBitmap;
    currentImageId = msg.id;
    
    // Initialize renderer if needed
    if (!renderer) {
      canvas = new OffscreenCanvas(currentImage.width, currentImage.height);
      renderer = new LUTCanvasRenderer(canvas);
    } else if (canvas) {
        // Resize canvas to match new image
        canvas.width = currentImage.width;
        canvas.height = currentImage.height;
        renderer.updateSize(currentImage.width, currentImage.height);
    }
  } else if (msg.type === 'RENDER') {
    const { lut, imageId, jobId } = msg;

    try {
      if (!currentImage || currentImageId !== imageId) {
        throw new Error('Image not loaded or ID mismatch');
      }
      if (!renderer || !canvas) {
        throw new Error('Renderer not initialized');
      }

      // Load LUT (uses IndexedDB cache inside)
      const lutData = await loadLUT(lut);

      // Render
      renderer.render(currentImage, lutData);

      // Transfer result back
      const resultBitmap = canvas.transferToImageBitmap();
      
      const response: WorkerResponse = {
        type: 'RENDER_COMPLETE',
        jobId,
        imageBitmap: resultBitmap
      };
      
      // @ts-ignore - Worker postMessage signature is different from Window
      self.postMessage(response, [resultBitmap]);

    } catch (error) {
      const response: WorkerResponse = {
        type: 'ERROR',
        jobId,
        error: error instanceof Error ? error.message : String(error)
      };
      self.postMessage(response);
    }
  }
};
