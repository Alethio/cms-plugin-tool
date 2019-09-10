# v1.0.0-beta.5

- Fix some errors when working with plugins that don't have a "name" field in package.json
- Add plugin manifest support at runtime and update plugin boilerplates (@alethio/cms@1.0.0-beta.7)

# v1.0.0-beta.4

- Add uninstall command for easily removing installed plugins
- Add rename command for easily changing the publisher, the plugin name or the npm package name of the plugin
- More verbose command output
- Better command options parsing and usage printing
- Add default .gitignore and .npmignore files to generated boilerplate.

## Breaking changes
- (`acp init`): `npm_package_name` is now the last argument and is optional.
- (`acp init`): `npm install` is automatically executed after generating the boilerplate.
- (`acp install`): will now overwrite existing plugin installations when switching to/from `--dev` mode.

# v1.0.0-beta.3

- Fix regression for plugins that don't have a scripts section in package.json

# v1.0.0-beta.2

- Allow installing plugins directly from git. If the `dist` folder is found, it will be used as-is, otherwise the plugin will be built on the spot, using the regular `npm install` method. Make sure your plugin has an npm "prepare" script defined. Otherwise the "build" script is used.
- Add "prepare" script in plugin boilerplates
- Fix some boilerplate placeholders not being replaced

# v1.0.0-beta.1

- Update JS plugin boilerplate with JSX support via Babel
