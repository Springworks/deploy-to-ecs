# Deploy to ECS

Github action for deploying new version of a service to ECS.

## Inputs

### `deploy-file`

**Required** Path to deploy file in repo. Defaults to `./deploy.json`

## Environment variables

### `AWS_ACCESS_KEY_ID`

**Required**

### `AWS_SECRET_ACCESS_KEY`

**Required**

### `AWS_REGION`

**Required**

## Example usage

```yml
- name: Deploy to ECS
  uses: springworks/deploy-to-ecs@master
  with:
    deploy-file: './deploy_files/deploy.json'
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    AWS_REGION: 'eu-west-1'
```
