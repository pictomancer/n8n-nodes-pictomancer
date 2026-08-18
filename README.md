# n8n-nodes-pictomancer

[n8n](https://n8n.io) community node for [Pictomancer.ai](https://pictomancer.ai) - image optimization in your workflows: resize, compress, convert (JPEG/PNG/WebP/TIFF/GIF/AVIF), crop, and multi-step pipelines.

## Install

In n8n: **Settings → Community Nodes → Install** and enter `n8n-nodes-pictomancer`.

Or with npm (self-hosted):

```bash
npm install n8n-nodes-pictomancer
```

## Credentials

Create a **Pictomancer API** credential:

- **API Key** - Bearer token from [app.pictomancer.ai](https://app.pictomancer.ai). Optional: without it you are on the free tier (50 requests per IP).
- **Base URL** - defaults to `https://api.pictomancer.ai`.

## Operations

| Operation | Input | Output |
|-----------|-------|--------|
| Analyze | URL or binary | JSON metadata (`size_bytes`) |
| Resize | URL or binary | Binary image |
| Compress | URL or binary | Binary image |
| Convert | URL or binary | Binary image |
| Crop | URL or binary | Binary image |
| Pipeline | URL or binary | Binary image |

- **Input Type** switches between a source URL and binary data from the previous node (sent as a `data:` URI).
- Image operations output binary data (default property `data`) plus `size_bytes`, `mime_type`, and `billed` in the item JSON. `billed` is `false` when compress produced no size gain - those requests are free.
- **Options** exposes quality (`q`), output format, metadata strip, lossless, and the AVIF `effort` knob.
- **Quality Target (SSIM)** (compress and convert): ask for the smallest file with SSIM >= target (0-1) instead of picking a `q` value. Mutually exclusive with Quality (`q`); jpeg, webp and avif only; compress needs an explicit Output Format. When the search runs, the item JSON also carries `quality_target`, `quality_achieved`, `quality_final_q`, and `quality_encodes`.
- **Crop Mode** (crop) switches between three mutually exclusive modes: **Manual** (X/Y/Width/Height), **Smart** (Gravity picks the window; needs Width/Height), and **Trim** (removes a uniform background border; Threshold defaults to 10). When a crop actually trims, the response carries `X-Pictomancer-Trim-Left/-Top/-Width/-Height` headers.
- **Fill Width / Fill Height / Gravity** (resize, under Options): set both to resize and smart-crop to exact dimensions in one call instead of Scale/Scale X/Scale Y.
- **Autorot** (resize, compress, convert, crop, under Options): apply EXIF orientation before processing.
- **Denoise** (resize, compress, convert, crop, under Options): median denoise before the operation, radius 1-3 (window 3x3 to 7x7). Base price.
- **Equalize** (resize, compress, convert, crop, under Options): auto-contrast (value-channel histogram equalisation, hue and saturation preserved) before the operation.
- **Sharpen** (resize, compress, convert, crop, under Options): unsharp-mask sharpen after the operation.
- Optimize AI-Generated: one-call web optimization of generator output (webp/avif/jpeg/png, max dimension, quality target)
- **Pipeline** takes a JSON list of steps, e.g. `[{ "type": "resize", "params": { "scale": "0.5" } }, { "type": "convert", "params": { "format": "webp" } }]`.

## Development

```bash
npm install
npm test
npm run build
```

## License

MIT
