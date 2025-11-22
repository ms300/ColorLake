export interface UploadedImage {
  id: string;
  name: string;
  originalFile: File; // Keep reference to the original file object
  originalUrl: string;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  previewWidth: number;
  previewHeight: number;
  sizeLabel: string;
}

export interface LUTMeta {
  id: string;
  name: string;
  file: string;
  category: string;
  hash?: string;
}

export interface LUTData {
  id: string;
  name: string;
  size: number;
  width: number;
  height: number;
  texture: Uint8Array;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  hash?: string;
}

export interface LUTLoadState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data?: LUTData;
  error?: string;
}
