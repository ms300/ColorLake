import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'LUTS');
const publicDir = path.join(rootDir, 'public', 'LUTS');
const outputFile = path.join(rootDir, 'src', 'data', 'luts.ts');

// Helper: Parse .cube text content
function parseCube(text) {
  const cleaned = text
    .split(/\r?\n/)
    .map((line) => line.split('#')[0].trim())
    .filter((line) => line.length > 0);

  let size = 0;
  let domainMin = [0, 0, 0];
  let domainMax = [1, 1, 1];
  const payload = [];

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

  if (size <= 0) throw new Error('Missing LUT_3D_SIZE');

  // Convert to Uint8Array (0-255)
  // Note: .cube format is usually R G B
  // But WebGL texture layout for 3D LUT simulation (2D texture) depends on how we sample it.
  // Our shader logic:
  // float uLow = (rIndex + sliceLow * size) * texelX + 0.5 * texelX;
  // float vCoord = gIndex * texelY + 0.5 * texelY;
  // This implies:
  // X axis (u) corresponds to Red (inner loop) + Blue (slice offset)
  // Y axis (v) corresponds to Green
  //
  // Standard .cube order is:
  // for B = 0 to N-1
  //   for G = 0 to N-1
  //     for R = 0 to N-1
  //       R G B
  //
  // So the data comes in as R changes fastest, then G, then B.
  //
  // If we map this directly to a 2D texture of width (size*size) and height (size):
  // Row 0 (v=0, G=0):
  //   Pixels 0..size-1: B=0, G=0, R=0..size-1
  //   Pixels size..2*size-1: B=1, G=0, R=0..size-1  <-- WAIT, this is where it gets tricky.
  //
  // Let's look at the shader again:
  // uLow = (rIndex + sliceLow * size) ...
  // This means U coordinate increases with R, and jumps by 'size' for each Blue slice.
  // So X axis contains all Red values for a given Green, laid out slice by slice (Blue).
  //
  // vCoord = gIndex ...
  // This means Y axis corresponds to Green.
  //
  // So the texture layout should be:
  // Width = size * size (Red * Blue)
  // Height = size (Green)
  //
  // But .cube data order is B -> G -> R (R changes fastest).
  // We need to reorder the data to match the texture layout:
  // Texture(x, y) where:
  //   y = G (0..size-1)
  //   x = R + B * size (0..size*size-1)
  //
  // So we need to iterate:
  // for G = 0 to size-1 (y)
  //   for B = 0 to size-1 (slice)
  //     for R = 0 to size-1 (inner x)
  //       index = (B * size * size) + (G * size) + R  <-- Index in .cube payload
  //       targetIndex = (y * width + x) * 4
  //
  // Let's verify .cube order. Adobe spec says:
  // "The lines of data are in order: Red changes fastest, then Green, then Blue."
  // So payload[0] is R=0,G=0,B=0
  // payload[1] is R=1,G=0,B=0
  // ...
  // payload[size] is R=0,G=1,B=0
  //
  // So payload index = R + G*size + B*size*size
  //
  // Our target texture layout (based on shader):
  // Y = G
  // X = R + B*size
  //
  // So we need to fill the buffer:
  // for G = 0 to size-1
  //   for B = 0 to size-1
  //     for R = 0 to size-1
  //       sourceIndex = R + G*size + B*size*size
  //       destIndex = (G * (size*size) + (B*size + R)) * 4
  //
  // Let's implement this reordering.

  const data = new Uint8Array(size * size * size * 4);
  
  for (let g = 0; g < size; g++) {
    for (let b = 0; b < size; b++) {
      for (let r = 0; r < size; r++) {
        // Source: .cube order (R changes fastest, then G, then B)
        const sourceIndex = r + g * size + b * size * size;
        
        // Dest: WebGL texture layout
        // Y = G
        // X = R + B * size
        // Width = size * size
        const destIndex = (g * (size * size) + (b * size + r)) * 4;
        
        if (sourceIndex < payload.length) {
            const [rv, gv, bv] = payload[sourceIndex];
            data[destIndex] = Math.min(255, Math.max(0, Math.round(rv * 255)));
            data[destIndex + 1] = Math.min(255, Math.max(0, Math.round(gv * 255)));
            data[destIndex + 2] = Math.min(255, Math.max(0, Math.round(bv * 255)));
            data[destIndex + 3] = 255;
        }
      }
    }
  }

  return { size, domainMin, domainMax, data };
}

// Helper: Write .clut binary file
function writeBinaryLUT(destPath, { size, domainMin, domainMax, data }) {
  // Header size: 4 (Magic) + 2 (Ver) + 2 (Size) + 12 (Min) + 12 (Max) = 32 bytes
  const headerSize = 32;
  const buffer = new ArrayBuffer(headerSize + data.length);
  const view = new DataView(buffer);

  // Magic "CLUT"
  view.setUint8(0, 67); // C
  view.setUint8(1, 76); // L
  view.setUint8(2, 85); // U
  view.setUint8(3, 84); // T

  // Version 1
  view.setUint16(4, 1, true); // Little endian

  // Size
  view.setUint16(6, size, true);

  // Domain Min
  view.setFloat32(8, domainMin[0], true);
  view.setFloat32(12, domainMin[1], true);
  view.setFloat32(16, domainMin[2], true);

  // Domain Max
  view.setFloat32(20, domainMax[0], true);
  view.setFloat32(24, domainMax[1], true);
  view.setFloat32(28, domainMax[2], true);

  // Data
  const uint8View = new Uint8Array(buffer, headerSize);
  uint8View.set(data);

  fs.writeFileSync(destPath, Buffer.from(buffer));
}

// 1. Prepare public directory
console.log('Preparing public/LUTS...');
try {
    if (fs.existsSync(publicDir)) {
        fs.rmSync(publicDir, { recursive: true, force: true });
    }
    fs.mkdirSync(publicDir, { recursive: true });
} catch (e) {
    console.error('Error preparing directories:', e);
    process.exit(1);
}

// 2. Scan and Convert files
console.log('Scanning and converting .cube files...');
const luts = [];

if (fs.existsSync(sourceDir)) {
  const items = fs.readdirSync(sourceDir, { withFileTypes: true });
  
  for (const item of items) {
    if (item.isDirectory()) {
      const category = item.name;
      const catSourceDir = path.join(sourceDir, category);
      const catDestDir = path.join(publicDir, category);
      
      if (!fs.existsSync(catDestDir)) {
        fs.mkdirSync(catDestDir, { recursive: true });
      }

      const files = fs.readdirSync(catSourceDir).filter(f => f.toLowerCase().endsWith('.cube'));
      
      // Sort files naturally
      files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      for (const file of files) {
        const name = path.basename(file, '.cube');
        const id = `${category}-${name}`.replace(/\s+/g, '-');
        
        try {
          // Read and parse .cube
          const cubeContent = fs.readFileSync(path.join(catSourceDir, file), 'utf-8');
          const lutData = parseCube(cubeContent);
          
          // Write .clut
          const clutFilename = name + '.clut';
          writeBinaryLUT(path.join(catDestDir, clutFilename), lutData);

          // Calculate hash of the binary data
          // We can use the data we just prepared for writing
          // Re-create buffer to hash it, or just hash the texture data + header info
          // Simpler: hash the source .cube content or the generated .clut file
          // Let's hash the generated .clut file content for accuracy
          const clutBuffer = fs.readFileSync(path.join(catDestDir, clutFilename));
          const hash = crypto.createHash('md5').update(clutBuffer).digest('hex').substring(0, 8);

          luts.push({
            id,
            name,
            file: `/LUTS/${category}/${clutFilename}`,
            category,
            hash
          });
          
          // console.log(`Converted: ${file} -> ${clutFilename}`);
        } catch (err) {
          console.error(`Failed to convert ${file}:`, err.message);
        }
      }
    }
  }
}

// 3. Generate Content
const content = `import { LUTMeta } from '../types';

export const LUT_LIBRARY: LUTMeta[] = ${JSON.stringify(luts, null, 2)};

export const PREVIEW_PAGE_SIZE = 12;
`;

// 4. Write file
fs.writeFileSync(outputFile, content);
console.log(`Successfully generated ${luts.length} LUT entries in ${outputFile}`);
