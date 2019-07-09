# Alethio CMS Plugin Tool

Command-line tool for installing/bootstrapping Alethio CMS plugins

`$ npm install -g @alethio/cms-plugin-tool`

`$ acp` for usage

## Testing plugins locally

Option 1: `acp link <plugin_path>` will symlink the plugin so we don't have to re-install it on every change.

Option 2: `acp install --dev <package_spec>` will fully install the plugin from an npm package. See `npm install` for the format of `package_spec`.

## Creating plugin boilerplate

Create a blank folder and switch to it. Run the following:

`$ acp init <plugin_npm_package_name> <publisher> <pluginName>`

or, if you prefer vanilla JavaScript instead of TypeScript:

`$ acp init --js <plugin_npm_package_name> <publisher> <pluginName>`

Finally, install the plugin dependencies and build it:

`$ npm install`
`$ npm run watch` for development or `$ npm run build` for minified build.
