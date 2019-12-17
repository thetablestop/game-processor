# Node Template

[![Build Status](https://travis-ci.org/thetablestop/game-processor.svg?branch=master)](https://travis-ci.org/thetablestop/game-processor)

Use this as a starting point for a node express app.

## Install

```
git clone git@github.com:thetablestop/game-processor.git
cd game-processor
yarn
```

## Run

```
yarn start
```

## CI/CD

### Build

-   The repository must first be added in [Travis CI](https://travis-ci.org/organizations/thetablestop/repositories)

-   Update `.travis.yml` to configure build. Most things will be able to be left as is, but the secure values will have to be replaced with the following [Travis CLI](https://github.com/travis-ci/travis.rb) commands:

```
travis encrypt GH_USERNAME={YOUR USERNAME} --add env.global
travis encrypt GH_TOKEN={YOUR PASSWORD} --add env.global
travis encrypt DOCKER_USERNAME={YOUR USERNAME} --add env.global
travis encrypt DOCKER_TOKEN={YOUR PASSWORD} --add env.global
travis encrypt "thetablestop:{SLACK WEBHOOK TOKEN}" --add notifications.slack
```

-   NOTE: It is recommended to generate an Personal Access Token in [DockerHub](https://hub.docker.com/settings/security) and [GitHub](https://github.com/settings/tokens) rather than entering the exact password.

### Deploy

-   First configure the repository

    -   [Go here](https://thetablestop.com:4433/p/c-mrlxw:p-tl4z9/pipeline/repositories) and enable the repository to add it to the pipeline.
    -   Go back to pipelines after clicking Save/Done and then click the 3 dots to the right of the new repository, then click Setting.
    -   In the settings, change the trigger from "Push" to "Tag"

-   In `deployment.yml` replace the application name "game-processor" with the appropriate name. Mostly this will be the only thing you need to fix. You may also want to change the `Replicas` property to the count of nodes the application needs at start.

-   If a public subdomain is required for this application, also replace the application name/subdomain in `deploy-ingress.yml`. If this is an internal only application, you can delete `deploy-ingress.yml` and remove this section from `.rancher-pipeline.yml`:

```yml
- applyYamlConfig:
  path: ./deploy-ingress.yml
```
