import { LUTMeta, UploadedImage } from '../types';
import { loadLUT } from '../hooks/useLUTData';
import { LUTCanvasRenderer } from './webglRenderer';

export async function exportProcessedImage(image: UploadedImage, lut: LUTMeta) {
  // 1. Load LUT Data
  const lutData = await loadLUT(lut);

  // 2. Load Original Image
  const img = new Image();
  img.crossOrigin = "anonymous"; // In case of CORS issues if using object URLs from blob it should be fine
  img.src = image.originalUrl;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  // 3. Create Canvas and Renderer
  const canvas = document.createElement('canvas');
  // Initial size, renderer will update it
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  
  const renderer = new LUTCanvasRenderer(canvas);

  // 4. Render
  try {
      renderer.render(img, lutData);
  } catch (e) {
      console.error("Render failed", e);
      renderer.dispose();
      throw e;
  }

  // 5. Download
  canvas.toBlob((blob) => {
    if (!blob) {
        renderer.dispose();
        return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Construct filename: original-name-lut-name.jpg
    const originalName = image.name.replace(/\.[^/.]+$/, "");
    const lutName = lut.name.replace(/\s+/g, '-');
    a.download = `${originalName}-${lutName}.jpg`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    renderer.dispose();
  }, 'image/jpeg', 0.9);
}
