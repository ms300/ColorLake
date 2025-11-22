const MAX_EDGE = 2048;
const MAX_PIXELS = 4_000_000;

export type ProcessorMessage = {
  file: File;
  id: string;
};

export type ProcessorResponse = 
  | { 
      type: 'SUCCESS'; 
      id: string; 
      originalWidth: number; 
      originalHeight: number; 
      previewWidth: number; 
      previewHeight: number; 
      previewBlob: Blob | null; 
    }
  | { type: 'ERROR'; id: string; error: string };

self.onmessage = async (e: MessageEvent<ProcessorMessage>) => {
  const { file, id } = e.data;
  
  try {
    const bitmap = await createImageBitmap(file);
    const width = bitmap.width;
    const height = bitmap.height;
    
    let scale = 1;
    const longest = Math.max(width, height);
    if (longest > MAX_EDGE) {
      scale = Math.min(scale, MAX_EDGE / longest);
    }
    const pixels = width * height;
    if (pixels > MAX_PIXELS) {
      scale = Math.min(scale, Math.sqrt(MAX_PIXELS / pixels));
    }
    
    let previewBlob: Blob | null = null;
    let previewWidth = width;
    let previewHeight = height;

    if (scale < 1) {
      previewWidth = Math.max(1, Math.round(width * scale));
      previewHeight = Math.max(1, Math.round(height * scale));
      
      const canvas = new OffscreenCanvas(previewWidth, previewHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context failed');
      
      ctx.drawImage(bitmap, 0, 0, previewWidth, previewHeight);
      previewBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
    }
    
    bitmap.close();

    self.postMessage({
      type: 'SUCCESS',
      id,
      originalWidth: width,
      originalHeight: height,
      previewWidth,
      previewHeight,
      previewBlob
    });

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
