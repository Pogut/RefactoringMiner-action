const exec = require('@actions/exec');

// PULL
const IMAGE_NAME = 'tsantalis/refactoringminer:latest';


// BUILD
const REPO_URL = 'https://github.com/pouryafard75/RM-ASTDiff.git';
const BRANCH_NAME = 'master';
const DOCKERFILE_PATH = 'RM-ASTDiff/docker/Dockerfile';

async function getImageFromDockerHub() {
  console.log(`Pulling Docker image: ${IMAGE_NAME}`);
  await exec.exec('docker', ['pull', IMAGE_NAME]);
  console.log("Done pulling image from dockerhub");
}

async function buildImageFromRepo() {
  console.log(`Cloning repository from ${REPO_URL} (branch: ${BRANCH_NAME})...`);
  await exec.exec(
    `git clone --single-branch --branch=${BRANCH_NAME} ${REPO_URL}`
  );

  console.log(`Building Docker image: ${IMAGE_NAME}`);
  await exec.exec(
    `docker build -f ${DOCKERFILE_PATH} -t ${IMAGE_NAME} RM-ASTDiff`
  );
  console.log('Done building image from repo');
}

module.exports = { getImageFromDockerHub, buildImageFromRepo };
