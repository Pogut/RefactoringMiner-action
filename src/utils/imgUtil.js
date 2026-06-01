const fs = require("fs");
const { PNG } = require('pngjs');
const ssim = require('ssim.js');


function compareImages(image1Path, image2Path) {
    const img1 = PNG.sync.read(fs.readFileSync(image1Path));
    const img2 = PNG.sync.read(fs.readFileSync(image2Path));

    const ssimResult = ssim.ssim(img1, img2);
    console.log(`SSIM Score: ${ssimResult.mssim}`);

    if (ssimResult.mssim > 0.50) {
        console.log("✅ Images are very similar with SSIM score: ", ssimResult.mssim);
        return true;
    } else {
        console.log("⚠️ Images differ with SSIM score: ", ssimResult.mssim);
        return false;
    }
}

module.exports = compareImages;