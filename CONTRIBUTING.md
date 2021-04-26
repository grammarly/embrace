# Contributing to Embrace

Embrace welcomes contribution from everyone. Here are the guidelines if you are thinking of helping out:

## Contributions

Contributions to Embrace or its dependencies should be made in the form of GitHub
pull requests. Each pull request will be reviewed by a core contributor
(someone with permission to land patches) and either landed in the main tree or
given feedback for changes that would be required. All contributions should
follow this format.

Any contribution intentionally submitted for inclusion in work by you, as defined in the Apache-2.0 license, without any additional terms or conditions.

## Prerequisites

- [node](https://nodejs.org/) 12.x
- [yarn](https://yarnpkg.com/) 1.x

If you have all prerequisites, run `yarn dev`.

## Testing and debugging

To test your changes, you can:

- Add a test (see examples in `/tests`) and run `yarn test`
- Or use the dev the version in the example app (`/example`) by changing the dependency in `package.json` to

```json
"@grammarly/embrace": "file:../"
```

## Communication

To reach out, create an issue, or submit a pull request.
