import type { LUTData, LUTMeta } from '../types';

export function parseBinaryLUT(meta: LUTMeta, buffer: ArrayBuffer): LUTData {
  const view = new DataView(buffer);
  
  // Check Magic "CLUT"
  if (
    view.getUint8(0) !== 67 ||
    view.getUint8(1) !== 76 ||
    view.getUint8(2) !== 85 ||
    view.getUint8(3) !== 84
  ) {
    throw new Error('Invalid CLUT file format');
  }

  // Version check (optional, for now we only have v1)
  // const version = view.getUint16(4, true);

  const size = view.getUint16(6, true);
  
  const domainMin: [number, number, number] = [
    view.getFloat32(8, true),
    view.getFloat32(12, true),
    view.getFloat32(16, true)
  ];

  const domainMax: [number, number, number] = [
    view.getFloat32(20, true),
    view.getFloat32(24, true),
    view.getFloat32(28, true)
  ];

  const headerSize = 32;
  const textureData = new Uint8Array(buffer, headerSize);

  // Validation
  const expectedSize = size * size * size * 4;
  if (textureData.length !== expectedSize) {
    // It might be that the buffer is larger than needed, which is fine, 
    // but if it's smaller, we have a problem.
    if (textureData.length < expectedSize) {
        throw new Error(`Corrupted LUT data: expected ${expectedSize} bytes, got ${textureData.length}`);
    }
    // If larger, we just slice what we need
    return {
        id: meta.id,
        name: meta.name,
        size,
        width: size * size,
        height: size,
        texture: textureData.slice(0, expectedSize),
        domainMin,
        domainMax,
        hash: meta.hash
    };
  }

  return {
    id: meta.id,
    name: meta.name,
    size,
    width: size * size,
    height: size,
    texture: textureData,
    domainMin,
    domainMax,
    hash: meta.hash
  };
}
