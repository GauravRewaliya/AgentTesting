// Headless Chrome with SOFTWARE WebGL. The harness used `--disable-gpu`, which also disables WebGL: every 3D page showed its "needs WebGL" fallback and the lead could not
// verify a three.js app (pp_eiffel: "the headless Chrome here has no WebGL"). SwiftShader renders WebGL on the CPU, so a 3D page can be opened, screenshotted and stepped through.
// (Verified by hand: the Eiffel tower, the Paris blocks, the photo plate and the 12-stop bar render with these flags.)
export const SOFT_GL = ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
