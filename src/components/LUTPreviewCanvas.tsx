import { useEffect, useRef, useState } from 'react';
import type { LUTMeta } from '../types';
import { previewWorkerManager } from '../utils/previewWorkerManager';

interface Props {
  imageUrl: string | null;
  lut: LUTMeta;
  highQuality?: boolean;
}

export function LUTPreviewCanvas({ imageUrl, lut, highQuality = false }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!imageUrl) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Extract a unique ID for the image (assuming blob URL or stable URL)
    const imageId = imageUrl;

    (async () => {
      try {
        // 1. Ensure image is set in worker
        // Pass highQuality flag to worker manager
        await previewWorkerManager.setImage(imageUrl, imageId, highQuality);
        
        if (cancelled) return;

        // 2. Request render
        const bitmap = await previewWorkerManager.renderPreview(lut, imageId);
        
        if (cancelled) {
            bitmap.close();
            return;
        }

        // 3. Draw to canvas
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                canvasRef.current.width = bitmap.width;
                canvasRef.current.height = bitmap.height;
                ctx.drawImage(bitmap, 0, 0);
            }
        }
        bitmap.close(); // Release memory

      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError('预览失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imageUrl, lut.id]); // Re-run if image or LUT changes

  return (
    <div className="lut-canvas">
      {loading && <span className="badge">处理中...</span>}
      {error && <span className="badge error">{error}</span>}
      
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
