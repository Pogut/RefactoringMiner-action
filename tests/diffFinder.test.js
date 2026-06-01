const getMatchingIds = require("../src/utils/diffFinder");
const path = require("path");

const resourcePath = "resources/test/";
const screenshotFolder = "screenshots/";
const artifactFolder = "artifact/";


describe("DiffFinder test", () => {
    let workspacePath;

    beforeAll(() => {
        workspacePath = path.join(__dirname, "../");  
    });

    test("Page Finder test", async () => {
        //Test Params
        const name = "alluxio9aeefcd8120bb3b89cdb437d8c32d2ed84b8a825";
        const screenshotInput = "MaxFree";
        const expectedResult = [0];

        const resBasePath = path.join(workspacePath,resourcePath,name);
        const pageNumbers = getMatchingIds(
            screenshotInput,
            path.join(path.join(resBasePath, artifactFolder)),
        );
        expect(pageNumbers).toEqual(expectedResult);
    });    
});
