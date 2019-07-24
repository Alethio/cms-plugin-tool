# Unreleased

- Add uninstall command for easily removing installed plugins
- Add rename command for easily changing the publisher, the plugin name or the npm package name of the plugin
- Behavior changed for `acp install`. It will now overwrite existing plugins when switching to/from `--dev` mode.
- Behavior change for `acp init`. Order of the parameters was changed. `npm_package_name` is now the last parameter and is optional. `npm install` is automatically executed after the boilerplate is generated.
- More verbose command output
- Add default .gitignore and .npmignore files to generated boilerplate.

# v1.0.0-beta.3

- Fix regression for plugins that don't have a scripts section in package.json

# v1.0.0-beta.2

- Allow installing plugins directly from git. If the `dist` folder is found, it will be used as-is, otherwise the plugin will be built on the spot, using the regular `npm install` method. Make sure your plugin has an npm "prepare" script defined. Otherwise the "build" script is used.
- Add "prepare" script in plugin boilerplates
- Fix some boilerplate placeholders not being replaced

# v1.0.0-beta.1

- Update JS plugin boilerplate with JSX support via Babel
