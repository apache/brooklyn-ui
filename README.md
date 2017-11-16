
# [![**Brooklyn**](https://brooklyn.apache.org/style/img/apache-brooklyn-logo-244px-wide.png)](http://brooklyn.apache.org/)

### Apache Brooklyn UI Sub-Project

This repo contains the JS GUI for Apache Brooklyn.

It is pure Javascript, but for legacy reasons it expects the REST endpoint at the same endpoint,
so currently the easiest way to run it is using the BrooklynJavascriptGuiLauncher java launcher 
in `brooklyn-server`.

### Building the project

2 methods are available to build this project: within a docker container or directly with maven.

#### Using docker

The project comes with a `Dockerfile` that contains everything you need to build this project.
First, build the docker image:

```bash
docker build -t brooklyn:ui .
```

Then run the build:

```bash
docker run -i --rm --name brooklyn-ui -v ${HOME}/.m2:/root/.m2 -v ${PWD}:/usr/build -w /usr/build brooklyn:ui mvn clean install
```

### Using maven

Simply run:

```bash
mvn clean install
```