import Foundation
import Vision
import AppKit

// 用法: ocr <图片路径>
// 输出: 每行 "yMin\txMin\theight\t文本"（y 为准化坐标，原点在左下，越大越靠上）
guard CommandLine.arguments.count > 1 else {
    print("{\"ok\":false,\"error\":\"missing image path\"}")
    exit(2)
}
let path = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: path),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("{\"ok\":false,\"error\":\"cannot load image\"}")
    exit(2)
}
// 透明图先铺白底，否则深色字识别率骤降
let W = cg.width, H = cg.height
var work = cg
if let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0,
                       space: CGColorSpaceCreateDeviceRGB(),
                       bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) {
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))
    if let flat = ctx.makeImage() { work = flat }
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["zh-Hans", "en-US"]
if #available(macOS 13.0, *) { request.revision = VNRecognizeTextRequestRevision3 }

let handler = VNImageRequestHandler(cgImage: work, options: [:])
do {
    try handler.perform([request])
} catch {
    print("{\"ok\":false,\"error\":\"vision failed\"}")
    exit(3)
}
var rows: [[String: Any]] = []
for obs in (request.results ?? []) {
    guard let cand = obs.topCandidates(1).first else { continue }
    let b = obs.boundingBox
    rows.append([
        "text": cand.string,
        "confidence": Double(cand.confidence),
        "x": Double(b.minX),
        "y": Double(b.minY),
        "w": Double(b.width),
        "h": Double(b.height)
    ])
}
// 按视觉从上到下、从左到右排序
rows.sort { a, b in
    let ay = a["y"] as! Double, by = b["y"] as! Double
    if abs(ay - by) > 0.008 { return ay > by }
    return (a["x"] as! Double) < (b["x"] as! Double)
}
let payload: [String: Any] = ["ok": true, "width": W, "height": H, "lines": rows]
if let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
   let text = String(data: data, encoding: .utf8) {
    print(text)
} else {
    print("{\"ok\":false,\"error\":\"encode failed\"}")
    exit(4)
}
