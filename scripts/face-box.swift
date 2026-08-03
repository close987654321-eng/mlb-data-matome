// 画像の顔ボックスを macOS Vision で実測して JSON で吐く。
//
//   swift scripts/face-box.swift <画像パス...>
//
// rizin5-portraits.mjs の SOURCES[].face（cx / cy / h）を埋めるための測定ツール。
// 素材を差し替えたら必ずこれで測り直す＝目分量でクロップすると顔の高さが揃わず、
// 「統一感がない」状態に逆戻りするため。macOS 専用（Vision.framework）。
import Foundation
import Vision
import AppKit

var out: [String: Any] = [:]
for path in CommandLine.arguments.dropFirst() {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        out[path] = ["error": "読み込めない"]
        continue
    }
    let req = VNDetectFaceRectanglesRequest()
    do {
        try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
    } catch {
        out[path] = ["error": "\(error)"]
        continue
    }
    // Vision の boundingBox は左下原点の正規化座標。中心と高さに直して返す。
    let faces = (req.results ?? [])
        .sorted { $0.confidence > $1.confidence }
        .map { obs -> [String: Any] in
            let b = obs.boundingBox
            return [
                "cx": (b.origin.x + b.size.width / 2 * 1.0).rounded(toPlaces: 3),
                "cy": (1 - b.origin.y - b.size.height / 2).rounded(toPlaces: 3),
                "h": b.size.height.rounded(toPlaces: 3),
                "conf": Double(obs.confidence).rounded(toPlaces: 2),
            ]
        }
    out[path] = ["w": cg.width, "h": cg.height, "faces": faces]
}

extension CGFloat {
    func rounded(toPlaces places: Int) -> Double {
        let m = pow(10.0, Double(places))
        return (Double(self) * m).rounded() / m
    }
}
extension Double {
    func rounded(toPlaces places: Int) -> Double {
        let m = pow(10.0, Double(places))
        return (self * m).rounded() / m
    }
}

let data = try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys])
print(String(data: data, encoding: .utf8)!)
