import type { LUTData, LUTMeta } from '../types';

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function parseCubeLUT(meta: LUTMeta, text: string): LUTData {
  const cleaned = text
    .split(/\r?\n/)
    .map((line) => line.split('#')[0].trim())
    .filter((line) => line.length > 0);

  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const payload: number[][] = [];

  cleaned.forEach((line) => {
    const upper = line.toUpperCase();
    if (upper.startsWith('LUT_3D_SIZE')) {
      size = Number(line.split(/\s+/)[1]);
      return;
    }
    if (upper.startsWith('DOMAIN_MIN')) {
      const [, ...rest] = line.split(/\s+/);
      if (rest.length >= 3) {
        domainMin = [Number(rest[0]), Number(rest[1]), Number(rest[2])];
      }
      return;
    }
    if (upper.startsWith('DOMAIN_MAX')) {
      const [, ...rest] = line.split(/\s+/);
      if (rest.length >= 3) {
        domainMax = [Number(rest[0]), Number(rest[1]), Number(rest[2])];
      }
      return;
    }

    const parts = line.split(/\s+/).map(Number).filter((n) => !Number.isNaN(n));
    if (parts.length >= 3) {
      payload.push([parts[0], parts[1], parts[2]]);
    }
  });

  if (size <= 0) {
    throw new Error(`${meta.name} 缺少 LUT_3D_SIZE 定义`);
  }

  const expected = size * size * size;
  if (payload.length < expected) {
    throw new Error(`${meta.name} 数据量不足 (期望 ${expected} 行)`);
  }

  const width = size * size;
  const height = size;
  const texture = new Uint8Array(width * height * 4);
  let cursor = 0;

  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        const [vr, vg, vb] = payload[cursor];
        cursor += 1;
        const x = r + b * size;
        const y = g;
        const idx = (x + y * width) * 4;
        texture[idx] = Math.round(clampUnit(vr) * 255);
        texture[idx + 1] = Math.round(clampUnit(vg) * 255);
        texture[idx + 2] = Math.round(clampUnit(vb) * 255);
        texture[idx + 3] = 255;
      }
    }
  }

  return {
    id: meta.id,
    name: meta.name,
    size,
    width,
    height,
    texture,
    domainMin,
    domainMax
  };
}
