const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

// 咖啡豆：棕色椭圆 + 沿长轴的 S 形浅色缝
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2, cy = size / 2;
  const rx = size * 0.30, ry = size * 0.44;
  const rot = -0.5;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      // 反旋转到豆子本地坐标
      const px = x - cx, py = y - cy;
      const u = px * cos + py * sin;
      const v = -px * sin + py * cos;
      const e = (u * u) / (rx * rx) + (v * v) / (ry * ry);
      let r = 0, g = 0, b = 0, a = 0;
      if (e <= 1) {
        // 边缘轻微压暗，做出立体感
        const shade = 1 - 0.18 * Math.min(1, e);
        r = 0xB0 * shade; g = 0x71 * shade; b = 0x3F * shade; a = 255;
        // 缝：本地坐标下 u 方向的 S 曲线
        const seam = Math.abs(u - 0.085 * rx * Math.sin((v / ry) * Math.PI * 1.6));
        if (seam < rx * 0.055 && Math.abs(v) < ry * 0.86) {
          r = 0xF6; g = 0xEA; b = 0xDC;
        }
      }
      raw[i] = Math.round(r); raw[i + 1] = Math.round(g); raw[i + 2] = Math.round(b); raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const dir = path.join(__dirname, '..', 'extension');
for (const s of [16, 48, 128]) fs.writeFileSync(path.join(dir, `icon${s}.png`), png(s));
console.log('icons written to', dir);
