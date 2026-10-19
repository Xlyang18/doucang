"use strict";
/* macOS Vision OCR 桥接
 * 优先用预编译的二进制（打包内置 / 缓存），没有就现场 swiftc 编译一次（约 10~20 秒）。
 * 全程本地，不联网、不上传图片。
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

const SRC = path.join(__dirname, 'ocr.swift');

function candidates(appRoot) {
  const list = [];
  if (appRoot) list.push(path.join(appRoot, 'electron', 'ocr', 'ocr'));
  list.push(path.join(__dirname, 'ocr', 'ocr'));
  list.push(path.join(os.tmpdir(), 'doucang-ocr', 'ocr'));
  list.push(path.join(os.homedir(), '.doucang', 'bin', 'ocr'));
  return list;
}

function isExecutable(p) {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch (e) {
    return false;
  }
}

function run(bin, imagePath, timeout = 60000) {
  return new Promise((resolve) => {
    execFile(bin, [imagePath], { timeout, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return resolve({ ok: false, error: `ocr failed: ${err.message}${stderr ? ` / ${stderr.slice(0, 200)}` : ''}` });
      try {
        const parsed = JSON.parse(String(stdout).trim() || '{}');
        resolve(parsed);
      } catch (e) {
        resolve({ ok: false, error: 'ocr output not json' });
      }
    });
  });
}

function compile(destDir) {
  return new Promise((resolve) => {
    fs.mkdirSync(destDir, { recursive: true });
    const out = path.join(destDir, 'ocr');
    execFile('xcrun', ['swiftc', '-O', SRC, '-o', out], { timeout: 180000 }, (err, stdout, stderr) => {
      if (err) return resolve({ ok: false, error: `swiftc failed: ${(stderr || err.message).slice(0, 400)}` });
      resolve({ ok: true, bin: out });
    });
  });
}

let cachedBin = null;

/** 确保 OCR 二进制可用 */
async function ensureBinary(appRoot) {
  if (cachedBin && isExecutable(cachedBin)) return { ok: true, bin: cachedBin };
  for (const c of candidates(appRoot)) {
    if (isExecutable(c)) {
      cachedBin = c;
      return { ok: true, bin: c, reused: true };
    }
  }
  const target = path.join(os.tmpdir(), 'doucang-ocr');
  const built = await compile(target);
  if (!built.ok) return built;
  cachedBin = built.bin;
  return { ok: true, bin: built.bin, compiled: true };
}

/** 识别图片 → { ok, lines:[{text,x,y,w,h}], width, height } */
async function recognize(imagePath, appRoot) {
  if (process.platform !== 'darwin') return { ok: false, error: 'OCR 目前仅支持 macOS' };
  if (!fs.existsSync(imagePath)) return { ok: false, error: '图片不存在' };
  const bin = await ensureBinary(appRoot);
  if (!bin.ok) return bin;
  const res = await run(bin.bin, imagePath);
  if (res && res.ok === false && res.error && /ocr failed|not json/.test(res.error)) {
    // 二进制可能被系统清理，重编一次
    cachedBin = null;
    const retry = await ensureBinary(appRoot);
    if (retry.ok) return run(retry.bin, imagePath);
  }
  return res;
}

module.exports = { recognize, ensureBinary };
