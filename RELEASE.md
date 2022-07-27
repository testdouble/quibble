# Cutting Releases

To cut a new release, first make sure the git working directory is clear and
then ensure the full suite of tests are passing:

```
$ npm run test:ci
```

We use some `preversion` and `postversion` script hooks to automate git & npm
pushing (and another round of testing), so to bump version and publish in one
go:

```
$ npm version patch
```

Same goes for `npm version minor` and `major`, naturally.
