import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count > 1, let image = NSImage(contentsOfFile: CommandLine.arguments[1]), let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { exit(2) }
let request = VNDetectBarcodesRequest()
request.symbologies = [.qr]
request.usesCPUOnly = true
try VNImageRequestHandler(cgImage: cgImage).perform([request])
guard let result = request.results?.first?.payloadStringValue else { exit(3) }
print(result)
