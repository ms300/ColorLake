## ColorLake - 一站式相机预设 (LUT) 预览和管理工具

ColorLake 是一个完全前端驱动的网页应用，面向调色师和摄影师，提供批量 LUT 预览、快速筛选以及左右对比滑杆等体验。所有计算均在浏览器内完成，无需后台服务或本地安装。

### 技术架构
- Vite + React + TypeScript 构建单页应用。
- WebGL fragment shader 将 3D LUT (`.cube`) 打平成 2D 纹理并在 GPU 中实时应用。
- 所有 LUT 文件放在 `public/LUTS`，静态托管即可。

### 核心功能
- 批量上传图片，自动生成缩略图列表，任意选择一张进入调色流程。
- 右侧预览矩阵一次展示多组 LUT 并支持分页切换。
- 点击任意预览图后，左侧进入对比模式，拖动 slider 可以在原图与套用 LUT 的画面之间实时切换。
- LUT 资源懒加载与缓存，首次点击时下载 LUT 文件，之后多处复用。

### 性能 / 体验优化
- 上传阶段自动对图片进行离线缩放：最长边控制在 2048px、像素数不超过约 400 万，以避免照片在浏览器中炸内存/显存。
- WebGL 纹理写入前再次校验硬件支持上限，必要时自动降级到安全尺寸，并在失败时给出回退预览。
- 对比模式的滑杆支持直接拖动中线，鼠标/触屏/键盘（方向键）均可精细控制。

### 目录结构
- `src/`：React 组件、WebGL Renderer 以及 LUT 解析工具。
- `public/LUTS/`：所有 `.cube` LUT 文件；可以替换为自己的预设合集，只需保持文件夹名称即可。
- `dist/`：运行 `npm run build` 后生成的静态资源，可直接部署到任意静态站点。

### 本地运行
```bash
npm install
npm run dev
```
开发服务器默认监听 `http://localhost:5173`。

### 生产构建
```bash
npm run build
npm run preview
```
`npm run build` 会输出打包好的静态文件，`npm run preview` 可本地验证生产版本。

### 自定义 LUT
1. 将新的 `.cube` 文件放入 `public/LUTS`（支持包含空格的文件名）。
2. 若需要展示顺序不同，可在 `src/data/luts.ts` 中调整数组顺序或增删条目。
3. 重新运行 `npm run dev` 或 `npm run build` 即可生效。