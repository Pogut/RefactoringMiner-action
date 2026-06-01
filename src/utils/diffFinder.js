const fs = require("fs");
const path = require("path");


function getMatchingIds(inputString, exportDir, infoFilePath='info.json') {
    console.log('Reading info.json...');
    const data = fs.readFileSync(path.join(exportDir, "web", infoFilePath), 'utf8');
    const jsonData = JSON.parse(data);
    const matchingIds = [];
    jsonData.diffInfos.forEach(item => {
        if (
            item.srcPath.toLowerCase().includes(inputString.toLowerCase()) || 
            item.dstPath.toLowerCase().includes(inputString.toLowerCase())
        ) {
            matchingIds.push(item.id);
        }
    });
    console.log('Matching IDs:', matchingIds);
    return matchingIds;
}

module.exports = getMatchingIds;

