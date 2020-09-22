const core = require('@actions/core');
const exec = require('@actions/exec');
const { readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');
const execa = require('execa');

function readFileSecret(secret_file) {
  return readFileSync(secret_file, 'utf8').trim();
}

async function deployToEcs(deploy_file, version) {
  try {
    process.env.SPLUNK_TOKEN = readFileSecret('./SECRET_SPLUNK_TOKEN.txt');
    process.env.SPLUNK_CLOUD_TOKEN = readFileSecret('./SECRET_SPLUNK_CLOUD_TOKEN.txt');
    process.env.NEW_RELIC_EVENT_INSERT_KEY = readFileSecret('./SECRET_NEW_RELIC_EVENT_INSERT_KEY.txt');
    process.env.NEW_RELIC_LICENSE_KEY = readFileSecret('./SECRET_NEW_RELIC_LICENSE_KEY.txt');
    process.env.NODE_AUTH_TOKEN = readFileSecret('./SECRET_NPM_TOKEN.txt');

    await exec.exec('npm i @springworks/ecs-deployer@2.26.0');
    await exec.exec('npm view @springworks/ecs-deployer@2.26.0');
    await exec.exec(`npx --package @springworks/ecs-deployer@2.26.0 ecs-deployer ${version} ${deploy_file}`);
  } catch (e) {
    throw new Error('deployToEcs failed');
  }
}

async function waitUntilStable(deploy_file) {
  try {
    const SERVICE_NAME = require(resolve(deploy_file)).service.serviceName;
    const CLUSTER_ARN = require(resolve(deploy_file)).service.cluster || 'default';
    await exec.exec(`aws ecs wait services-stable --cluster ${CLUSTER_ARN} --services ${SERVICE_NAME}`);
  } catch (e) {
    throw new Error('waitUntilStable failed');
  }
}

async function notifyDeployment(deploy_file, version) {
  try {
    process.env.NODE_DEPLOYMENT_NOTIFIER_SLACK_WEBHOOK_URL = readFileSecret('./SECRET_NODE_DEPLOYMENT_NOTIFIER_SLACK_WEBHOOK_URL.txt');
    process.env.NODE_DEPLOYMENT_NOTIFIER_SLACK_USERNAME = readFileSecret('./SECRET_NODE_DEPLOYMENT_NOTIFIER_SLACK_USERNAME.txt');
    process.env.NODE_DEPLOYMENT_NOTIFIER_SLACK_CHANNEL = readFileSecret('./SECRET_NODE_DEPLOYMENT_NOTIFIER_SLACK_CHANNEL.txt');
    process.env.NODE_DEPLOYMENT_NOTIFIER_WEBHOOK_URL = readFileSecret('./SECRET_NODE_DEPLOYMENT_NOTIFIER_WEBHOOK_URL.txt');
    process.env.NODE_DEPLOYMENT_NOTIFIER_WEBHOOK_BASIC_AUTH_USERNAME = readFileSecret('./SECRET_NODE_DEPLOYMENT_NOTIFIER_WEBHOOK_BASIC_AUTH_USERNAME.txt');
    process.env.NODE_DEPLOYMENT_NOTIFIER_WEBHOOK_BASIC_AUTH_PASSWORD = readFileSecret('./SECRET_NODE_DEPLOYMENT_NOTIFIER_WEBHOOK_BASIC_AUTH_PASSWORD.txt');

    const CURRENT_TAG = version;
    const ENVIRONMENT = deploy_file;

    const { stdout: all_tags } = await execa('git', ['for-each-ref', '--sort=-committerdate', '--format', '"%(refname:short)"', 'refs/tags']);
    const only_tags_with_v = all_tags.split('\n').filter((tag) => tag.startsWith('"v'));
    let PREVIOUS_TAG = only_tags_with_v.length > 1 ? only_tags_with_v[1] : null;

    if (!PREVIOUS_TAG) {
      // Magic "empty repo" commit hash
      PREVIOUS_TAG = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
    }

    await exec.exec(`npx --package deployment-notifier deployment-completed -N ${process.env.REPOSITORY_NAME} -P ${PREVIOUS_TAG} -T ${CURRENT_TAG} -E "${ENVIRONMENT}"`);
  } catch (e) {
    throw new Error('notifyDeployment failed');
  }
}

async function run() {
  try {
    if(!process.env.REPOSITORY_NAME) {
      throw new Error('Required environment variable REPOSITORY_NAME is not set.');
    }

    const deploy_file = core.getInput('deploy-file');
    const version = readFileSecret('./VERSION/VERSION.txt');

    process.env.AWS_DEFAULT_REGION = process.env.AWS_REGION;

    await deployToEcs(deploy_file, version);
    await waitUntilStable(deploy_file);
    await notifyDeployment(deploy_file, version);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
