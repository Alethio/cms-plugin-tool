# Unreleased

- Add uninstall command for easily removing installed plugins
- Behavior changed for `acp install --dev`. It will now also overwrite any versions previously installed without `--dev`.
- More verbose command output

# v1.0.0-beta.3

- Fix regression for plugins that don't have a scripts section in package.json

# v1.0.0-beta.2

- Allow installing plugins directly from git. If the `dist` folder is found, it will be used as-is, otherwise the plugin will be built on the spot, using the regular `npm install` method. Make sure your plugin has an npm "prepare" script defined. Otherwise the "build" script is used.
- Add "prepare" script in plugin boilerplates
- Fix some boilerplate placeholders not being replaced

# v1.0.0-beta.1

- Update JS plugin boilerplate with JSX support via Babel
