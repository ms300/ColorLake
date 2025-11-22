import type { LUTData } from '../types';

const vertexSource = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentSource = `
precision mediump float;
uniform sampler2D u_image;
uniform sampler2D u_lut;
uniform float u_lutSize;
varying vec2 v_texCoord;

vec4 sampleAs3DTexture(vec3 color) {
  float size = u_lutSize;
  float texelX = 1.0 / (size * size);
  float texelY = 1.0 / size;
  vec3 scaled = clamp(color, 0.0, 1.0) * (size - 1.0);

  float slice = scaled.b;
  float sliceLow = floor(slice);
  float sliceHigh = min(sliceLow + 1.0, size - 1.0);
  float blend = slice - sliceLow;

  float rIndex = scaled.r;
  float gIndex = scaled.g;

  float uLow = (rIndex + sliceLow * size) * texelX + 0.5 * texelX;
  float uHigh = (rIndex + sliceHigh * size) * texelX + 0.5 * texelX;
  float vCoord = gIndex * texelY + 0.5 * texelY;

  vec4 sampleLow = texture2D(u_lut, vec2(uLow, vCoord));
  vec4 sampleHigh = texture2D(u_lut, vec2(uHigh, vCoord));
  return mix(sampleLow, sampleHigh, blend);
}

void main() {
  vec4 original = texture2D(u_image, v_texCoord);
  vec4 graded = sampleAs3DTexture(original.rgb);
  gl_FragColor = vec4(graded.rgb, original.a);
}
`;

export class LUTCanvasRenderer {
  private gl: WebGLRenderingContext;

  private program: WebGLProgram;

  private positionBuffer: WebGLBuffer;

  private texCoordBuffer: WebGLBuffer;

  private imageTexture: WebGLTexture;

  private lutTexture: WebGLTexture | null = null;

  private maxTextureSize: number;

  private disposed = false;

  private attribLocations: { position: number; texCoord: number };

  private uniformLocations: { image: WebGLUniformLocation | null; lut: WebGLUniformLocation | null; lutSize: WebGLUniformLocation | null };

  constructor(private canvas: HTMLCanvasElement | OffscreenCanvas) {
    const gl = canvas.getContext('webgl') as WebGLRenderingContext;
    if (!gl) {
      throw new Error('当前浏览器不支持 WebGL');
    }
    this.gl = gl;
    this.program = this.createProgram(vertexSource, fragmentSource);
    this.attribLocations = {
      position: gl.getAttribLocation(this.program, 'a_position'),
      texCoord: gl.getAttribLocation(this.program, 'a_texCoord')
    };
    this.uniformLocations = {
      image: gl.getUniformLocation(this.program, 'u_image'),
      lut: gl.getUniformLocation(this.program, 'u_lut'),
      lutSize: gl.getUniformLocation(this.program, 'u_lutSize')
    };
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.positionBuffer = this.createBuffer(new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1
    ]));
    this.texCoordBuffer = this.createBuffer(new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      1, 0
    ]));
    this.imageTexture = this.createTexture();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    const { gl } = this;
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.texCoordBuffer);
    gl.deleteTexture(this.imageTexture);
    if (this.lutTexture) {
      gl.deleteTexture(this.lutTexture);
    }
    gl.deleteProgram(this.program);
    this.disposed = true;
  }

  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error('无法创建 shader');
    }
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const reason = this.gl.getShaderInfoLog(shader) ?? '未知错误';
      this.gl.deleteShader(shader);
      throw new Error(`Shader 编译失败: ${reason}`);
    }
    return shader;
  }

  private createProgram(vertex: string, fragment: string): WebGLProgram {
    const program = this.gl.createProgram();
    if (!program) {
      throw new Error('无法创建 program');
    }
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertex);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragment);
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const reason = this.gl.getProgramInfoLog(program) ?? '未知错误';
      this.gl.deleteProgram(program);
      throw new Error(`Program 链接失败: ${reason}`);
    }
    return program;
  }

  private createBuffer(data: Float32Array): WebGLBuffer {
    const buffer = this.gl.createBuffer();
    if (!buffer) {
      throw new Error('无法创建 buffer');
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
    return buffer;
  }

  private createTexture(): WebGLTexture {
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error('无法创建 texture');
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    return texture;
  }

  private ensureLUTTexture(): WebGLTexture {
    if (!this.lutTexture) {
      this.lutTexture = this.createTexture();
    }
    return this.lutTexture;
  }

  updateSize(width: number, height: number): void {
    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }
    this.canvas.width = width;
    this.canvas.height = height;
  }

  private readDimensions(image: TexImageSource): { width: number; height: number } {
    // Check for HTMLImageElement safely (it doesn't exist in Worker scope)
    if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) {
      return {
        width: image.naturalWidth || image.width || 1,
        height: image.naturalHeight || image.height || 1
      };
    }
    // Check for HTMLCanvasElement safely
    if (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) {
      return { width: image.width, height: image.height };
    }
    // OffscreenCanvas or ImageBitmap
    if ('width' in image && 'height' in image) {
      // @ts-ignore - ImageBitmap/OffscreenCanvas types
      return { width: image.width, height: image.height };
    }
    return { width: this.canvas.width, height: this.canvas.height };
  }

  private ensureSafeSource(image: TexImageSource): TexImageSource {
    const { width, height } = this.readDimensions(image);
    const largest = Math.max(width, height);
    if (largest <= this.maxTextureSize) {
      return image;
    }
    const ratio = this.maxTextureSize / largest;
    const targetWidth = Math.max(1, Math.round(width * ratio));
    const targetHeight = Math.max(1, Math.round(height * ratio));
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const context = canvas.getContext('2d');
    if (!context) {
      return image;
    }
    context.drawImage(image as CanvasImageSource, 0, 0, targetWidth, targetHeight);
    return canvas;
  }

  private pushImage(image: TexImageSource): void {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
    // ImageBitmap and OffscreenCanvas are already top-down, so we don't need to flip
    // But HTMLImageElement usually needs flipping in WebGL
    // However, for consistency in our pipeline (Worker -> ImageBitmap), let's disable flip
    // and handle coordinates in shader or assume input is correct.
    // Actually, ImageBitmap is usually Y-down (standard image), WebGL is Y-up.
    // If we see it flipped, we should toggle this.
    // User says it's flipped (upside down), so we should probably turn OFF UNPACK_FLIP_Y_WEBGL
    // or change the texture coordinates.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); 
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }

  private pushLUT(lut: LUTData): void {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE1);
    const texture = this.ensureLUTTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, lut.width, lut.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut.texture);
  }

  render(image: TexImageSource, lut: LUTData): void {
    if (this.disposed) {
      return;
    }
    const safeImage = this.ensureSafeSource(image);
    const { width, height } = this.readDimensions(safeImage);
    this.updateSize(width, height);
    const { gl } = this;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.attribLocations.position);
    gl.vertexAttribPointer(this.attribLocations.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.attribLocations.texCoord);
    gl.vertexAttribPointer(this.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);

    this.pushImage(safeImage);
    this.pushLUT(lut);

    gl.uniform1i(this.uniformLocations.image, 0);
    gl.uniform1i(this.uniformLocations.lut, 1);
    gl.uniform1f(this.uniformLocations.lutSize, lut.size);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
