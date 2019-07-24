# Alethio CMS Plugin Tool

Command-line tool for installing/bootstrapping Alethio CMS plugins

## Installing the tool

`$ npm install -g @alethio/cms-plugin-tool`

*NOTE*: When using the tool in a deployment pipeline, we recommend specifying a fixed version instead of the implicit `latest` dist-tag.

## Usage

See `$ acp -h` for available commands.

See `$ acp [command] -h` for usage on each command.

## Use cases

### Testing/developing plugins locally

There are two methods of installing a plugin for local development:

We assume the current directory is the checkout of the host app, which uses the default `dist/plugins` target.

**Method 1**: `acp link <plugin_path...>` will symlink the plugin(s) found at the specified path so we don't have to re-install on every change.

*Example*: `$ acp link ~/workspace/my-plugin-checkout`

**Method 2**: `acp install --dev <package_spec...>` will install plugin(s) from npm / GitHub / local path etc. See [npm install](https://docs.npmjs.com/cli/install) for the format of `package_spec`.

*Example*: `$ acp install --dev @my-npm-scope/my-plugin MyGitHubHandle/my-other-plugin ~/workspace/my-local-plugin`

### Installing plugins for production

`acp install <package_spec...>` will install plugin(s) from npm / GitHub / local path etc. See [npm install](https://docs.npmjs.com/cli/install) for the format of `package_spec`.

*Example*: `$ acp install @my-npm-scope/my-plugin MyGitHubHandle/my-other-plugin ~/workspace/my-local-plugin`

**NOTE**: If the plugin is installed from a source different than npm, it will be built ad-hoc, using the "prepare" script in its package.json manifest. Also, if a "dist" folder is found, it will be used instead.

### Uninstalling plugins

You can simply delete the plugin folders under the `dist/plugins` path in your host app or run the `acp uninstall` command.

*Example*: In your host app checkout folder run `$ acp uninstall @my-npm-scope/my-plugin@1.0.0`

### Creating plugin boilerplate

Create a blank folder for your plugin and switch to it. Run the following:

`$ acp init <publisher> <pluginName> [plugin_npm_package_name]`

or, if you prefer vanilla JavaScript instead of TypeScript:

`$ acp init --js <publisher> <pluginName> [plugin_npm_package_name]`

*NOTES*:
- `plugin_npm_package_name` is only needed if you plan to publish your plugin to npm. You can also manually add it later in your package.json.
- The `init` command will also install the plugin dependencies for you and build the initial version.

You can then re-build the plugin when making changes with:

- `$ npm run watch` for development
- `$ npm run build` for minified production build

### Renaming a plugin

You can change the plugin or publisher names, or even the npm package name using the `acp rename` command.

In your plugin folder execute:

`$ acp rename <publisher> <plugin_name> [npm_package_name]`

*NOTE*: If you don't specify `npm_package_name` it will be assumed blank and be removed from package.json. `npm install` is also executed after a successful operation.
