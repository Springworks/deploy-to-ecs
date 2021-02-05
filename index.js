const core = require('@actions/core');
const { exec } = require('@actions/exec');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const execa = require('execa');

function readFileSecret(secret_file) {
  return readFileSync(secret_file, 'utf8').trim();
}

function readVersionFile() {
  try {
    // This path is used by `actions/download-artifact@v2` unless a path is specified to match the behaviour of v1.
    return readFileSecret('./VERSION.txt');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // err.code will be ENOENT if the file does not exist
      throw error;
    }
  }
  try {
    // This path is used by `actions/download-artifact@v1`. It will create a dir with the name of the artifact (VERSION).
    return readFileSecret('./VERSION/VERSION.txt');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  throw new Error(`Could not find the VERSION artifact.
Make sure that actions/upload-artifact and actions/download-artifact are configured correctly.

Example:

    # in the tag-and-push-to-ecr step
      - name: Upload version
        uses: actions/upload-artifact@v2.2.0
        with:
          name: VERSION
          path: VERSION.txt

    # in the deploy-to-ecs step
      - name: Download version
        uses: actions/download-artifact@v2.0.5
        with:
          name: VERSION
`);
}

async function deployToEcs(deploy_file, version) {
  try {
    process.env.SPLUNK_TOKEN = readFileSecret('./SECRET_SPLUNK_TOKEN.txt');
    process.env.NEW_RELIC_EVENT_INSERT_KEY = readFileSecret('./SECRET_NEW_RELIC_EVENT_INSERT_KEY.txt');
    process.env.NEW_RELIC_LICENSE_KEY = readFileSecret('./SECRET_NEW_RELIC_LICENSE_KEY.txt');
    process.env.NODE_AUTH_TOKEN = readFileSecret('./SECRET_NPM_TOKEN.txt');

    await exec('node_modules/.bin/ecs-deployer', [version, deploy_file], { cwd: __dirname });
  } catch (error) {
    core.error(error);
    throw new Error('deployToEcs failed');
  }
}

async function waitUntilStable(deploy_file) {
  try {
    const SERVICE_NAME = require(resolve(deploy_file)).service.serviceName;
    const CLUSTER_ARN = require(resolve(deploy_file)).service.cluster || 'default';
    await exec('aws', ['ecs', 'wait', 'services-stable', '--cluster', CLUSTER_ARN, '--services', SERVICE_NAME]);
  } catch (e) {
    core.error(e);
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

    const { stdout: all_tags } = await execa('git', ['tag', '-l', '--sort=-creatordate']);
    const only_tags_with_v = all_tags.split('\n').filter((tag) => tag.startsWith('v'));
    const PREVIOUS_TAG = only_tags_with_v.length > 1 ? only_tags_with_v[1] : null;

    if (!PREVIOUS_TAG) {
      const tags_json = JSON.stringify({ all_tags: all_tags.split('\n') }, null, 2);
      core.error(`PREVIOUS_TAG not found. ${tags_json}`);
      return;
    }

    await exec('node_modules/.bin/deployment-completed', ['-N', process.env.REPOSITORY_NAME, '-P', PREVIOUS_TAG, '-T', CURRENT_TAG, '-E', ENVIRONMENT], { cwd: __dirname });
  } catch (error) {
    core.error(`notifyDeployment failed: ${error}`);
  }
}

async function run() {
  try {
    if (!process.env.REPOSITORY_NAME) {
      throw new Error('Required environment variable REPOSITORY_NAME is not set.');
    }

    const deploy_file = core.getInput('deploy-file');
    const version = readVersionFile();

    process.env.AWS_DEFAULT_REGION = process.env.AWS_REGION;

    await deployToEcs(deploy_file, version);
    await waitUntilStable(deploy_file);
    await notifyDeployment(deploy_file, version);
  } catch (error) {
    core.setFailed(error);
  }
}

run();
