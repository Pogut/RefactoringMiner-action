const takeScreenshots = require("../src/utils/screenshot");
const path = require("path");
const fs = require("fs");
const outFolder = "out/";
const artifactFolder = "artifact/";
const screenshotFolder = "screenshots/";
const resourcePath = "resources/test/";
const compareImages = require("../src/utils/imgUtil");

describe("Screenshot Test", () => {
    beforeAll(() => {
      workspacePath = path.join(__dirname, "../");  
      outDir = path.join(workspacePath, outFolder);
      if (fs.existsSync(outDir)) {
        fs.rmdirSync(outDir, { recursive: true });
      }
    });

    test ("Screen capture test", async () => {
      // test parameters
      const name = "alluxio9aeefcd8120bb3b89cdb437d8c32d2ed84b8a825";
      const screenshotInput = "MaxFree";
      const expectedNumberOfScreenshots = 1;

      const screenshotOutputPath = path.join(outDir, name, screenshotFolder);
      const resBasePath = path.join(workspacePath,resourcePath,name);
      console.log(`Calling takeScreenshots`);
      const numberOfScreenshots = await takeScreenshots(
          screenshotInput,
          path.join(resBasePath, artifactFolder),
          screenshotOutputPath
      );

      expect(numberOfScreenshots).toBe(expectedNumberOfScreenshots);
      for (let i = 1; i <= expectedNumberOfScreenshots; i++) {
        const generatedFile = path.join(screenshotOutputPath, `${i}.png`);
        const referenceFile = path.join(resBasePath, screenshotFolder , `${i}.png`);
        await expect(fs.existsSync(generatedFile)).toBe(true);
        await expect(compareImages(generatedFile, referenceFile)).toBe(true);
      }
    },20000 * 5);

    afterAll(() => {
      if (fs.existsSync(outDir)) {
        fs.rmdirSync(outDir, { recursive: true });
      }
    });
});