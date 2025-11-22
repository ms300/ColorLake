const MAX_EDGE = 2048;
const MAX_PIXELS = 4_000_000;

type ImageSource = HTMLImageElement;

function loadImage(url: string): Promise<ImageSource> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = url;
  });
}

async function drawScaledImage(image: ImageSource, width: number, height: number): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('浏览器不支持 Canvas 2D');
  }
  context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error('无法生成预览图')); 
      }
    }, 'image/jpeg', 0.92);
  });
  return URL.createObjectURL(blob);
}

function calcScale(width: number, height: number): number {
  let scale = 1;
  const longest = Math.max(width, height);
  if (longest > MAX_EDGE) {
    scale = Math.min(scale, MAX_EDGE / longest);
  }
  const pixels = width * height;
  if (pixels > MAX_PIXELS) {
    scale = Math.min(scale, Math.sqrt(MAX_PIXELS / pixels));
  }
  return scale;
}

export interface PreparedImageAsset {
  originalUrl: string;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  previewWidth: number;
  previewHeight: number;
}

export async function prepareImageAsset(file: File): Promise<PreparedImageAsset> {
  const originalUrl = URL.createObjectURL(file);
  const image = await loadImage(originalUrl);
  const { width, height } = image;
  const scale = calcScale(width, height);

  if (scale < 1) {
    const previewWidth = Math.max(1, Math.round(width * scale));
    const previewHeight = Math.max(1, Math.round(height * scale));
    const previewUrl = await drawScaledImage(image, previewWidth, previewHeight);
    return {
      originalUrl,
      previewUrl,
      originalWidth: width,
      originalHeight: height,
      previewWidth,
      previewHeight
    };
  }

  return {
    originalUrl,
    previewUrl: originalUrl,
    originalWidth: width,
    originalHeight: height,
    previewWidth: width,
    previewHeight: height
  };
}
