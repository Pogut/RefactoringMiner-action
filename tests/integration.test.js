const path = require("path");
const fs = require("fs");
const run = require("../src/utils/core"); 
const compareImages = require("../src/utils/imgUtil");
// This is problematic as it executes the run() on the fly, since run() is invoked in the index.js
// We need to extract the run into separate function and call it in the index.js to prevent the run() from being executed on the require
// Test in this file will be skipped at the moment.

const baseOutFolder = "integrationOut/";
const screenshotFolder = "screenshots/";
const resourcePath = "resources/test/";



describe("Integration Test", () => {
  let workspacePath;
  let outDir;

  beforeAll(() => {
    workspacePath = path.join(__dirname, "../");
    outDir = path.join(workspacePath, baseOutFolder);
    if (fs.existsSync(outDir)) {
      fs.rmdirSync(outDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(outDir)) {
      fs.rmdirSync(outDir, { recursive: true });
    }
  });

  describe.each([
    {
      name: "alluxio9aeefcd8120bb3b89cdb437d8c32d2ed84b8a825",
      screenshotInput: "MaxFree",
      expectedNumberOfScreenshots: 1,
      url: "https://github.com/Alluxio/alluxio/commit/9aeefcd8120bb3b89cdb437d8c32d2ed84b8a825",
    },
    {
      name: "kafkad171ff08a70f9fa8065e6661fcc1f3da092d7faf",
      screenshotInput: "ConfigurationControlManagerTest.java",
      expectedNumberOfScreenshots: 1,
      url: "https://github.com/apache/kafka/commit/d171ff08a70f9fa8065e6661fcc1f3da092d7faf", 
    }
  ])("Test Integration", ({ name, screenshotInput, expectedNumberOfScreenshots, url }) => {
    test(`Integration test ${name}`, async () => {
      console.log(`Running test for ${name}`);
      process.env.GITHUB_WORKSPACE = process.cwd();
      process.env.defaultURLValue = url;
      process.env.defaultOAuthTokenValue = process.env.OAuthToken;
      process.env.defaultScreenshotValue = screenshotInput;
      outFolder = outDir + name;
      await run(outFolder);
      const screenshotOutputPath = path.join(outDir, name);
      const resBasePath = path.join(workspacePath, resourcePath, name);
      console.log(`Calling takeScreenshots`);
      for (let i = 1; i <= expectedNumberOfScreenshots; i++) {
        const generatedFile = path.join(screenshotOutputPath, `${i}.png`);
        const referenceFile = path.join(resBasePath, screenshotFolder, `${i}.png`);    
        compareImages(generatedFile, referenceFile); 
        //TODO: Add assertion for the comparison
      }
    }, 10000 * 10);
  });
});
