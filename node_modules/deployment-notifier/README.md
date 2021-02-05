# Deployment Notifier

[![Build Status](https://travis-ci.org/Springworks/node-deployment-notifier.png?branch=master)](https://travis-ci.org/Springworks/node-deployment-notifier)
[![Coverage Status](https://coveralls.io/repos/Springworks/node-deployment-notifier/badge.png?branch=master)](https://coveralls.io/r/Springworks/node-deployment-notifier?branch=master)

Lets you know when you should deploy and when the deployment is complete.

Useful when:

- You need a human to make a decision of which version to deploy (if you want to do that when committing, look at [semantic-release](https://www.npmjs.com/package/semantic-release) or similar).
- You're using Slack
- You have another webhook that also needs to record deployment

## Environment variables

All environment variables are required.

**Define to notify Slack**
- `NODE_DEPLOYMENT_NOTIFIER_SLACK_WEBHOOK_URL`: URL to the Slack webhook
- `NODE_DEPLOYMENT_NOTIFIER_SLACK_CHANNEL`: Slack channel name to post messages to, e.g. `#deployments`
- `NODE_DEPLOYMENT_NOTIFIER_SLACK_USERNAME`: Username to use when posting, e.g. `Row Bot`

**Define for generic webhook**
- `NODE_DEPLOYMENT_NOTIFIER_WEBHOOK_URL`: URL to use when posting webhook with deployment info
- `NODE_DEPLOYMENT_NOTIFIER_WEBHOOK_BASIC_AUTH_USERNAME`: Basic auth username for webhook
- `NODE_DEPLOYMENT_NOTIFIER_WEBHOOK_BASIC_AUTH_PASSWORD`: Basic auth password for webhook

## Usage

Install module globally:

```
npm install -g deployment-notifier
```

### Suggest deployment
Sends Slack notification with a suggestion to make a deployment.

Includes changelog (since last deployment).

**Usage**
```
  Usage: deployment-suggestion [options]

  Options:

    -h, --help                             output usage information
    -N, --app-name <app name>              Application name
    -T, --latest-deployment-tag <git tag>  Name of tag for latest deployment
    -U, --deploy-url <url>                 URL where a deployment can be started
```

**Example**

```
$ deployment-suggestion --app-name "some app" --tag-name v1.0.0 
```

### Record deployment
Sends message after a deployment has completed, to both Slack webhook and HTTP webhook.

Includes changes in the new version.

**Usage**
```
  Usage: deployment-completed [options]

  Options:

    -h, --help                               output usage information
    -N, --app-name <app name>                Application name
    -M, --message <release notes>            Release notes (required unless providing tags)
    -P, --previous-deployment-tag <git tag>  Name of tag for previous deployment
    -T, --deployment-tag <git tag>           Name of tag for latest deployment
    -E, --environment <target environment>   The environment deployment was targeted at
```

## License

MIT
