// @ts-check
const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const pacote = require("pacote");
const validateNpmPackageName = require("validate-npm-package-name");

(async () => {
    let [, , cmd, ...args] = process.argv;

    if (!cmd) {
        printUsage();
        process.exit(0);
    }

    if (cmd === "install" || cmd === "link") {
        let targetDir = path.resolve(process.cwd(), "dist", "plugins");
        if (args[0] === "-t" || args[0] === "--target") {
            args.shift();
            targetDir = path.resolve(args.shift());
        }
        let pluginPaths = args;

        if (!pluginPaths.length) {
            printUsage();
            process.exit(-1);
        }

        if (cmd === "install") {
            let devMode = false;
            if (pluginPaths[0] === "-d" || pluginPaths[0] === "--dev") {
                pluginPaths.shift();
                devMode = true;
            }

            let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "acp-"));
            try {
                for (let pluginArg of pluginPaths) {
                    await installPlugin(targetDir, pluginArg, tmpDir, devMode);
                }
            } finally {
                fs.emptyDirSync(tmpDir);
                fs.rmdirSync(tmpDir);
            }
        } else if (cmd === "link") {
            for (let pluginPath of pluginPaths) {
                await linkPlugin(targetDir, pluginPath);
            }
        }
    } else if (cmd === "init") {
        let jsMode = false;
        if (args[0] === "--js") {
            args.shift();
            jsMode = true;
        }
        if (args.length !== 3) {
            process.stderr.write("Invalid number of arguments\n\n");
            printUsage();
            process.exit(-1);
        }

        let [npmPackageName, publisher, pluginName] = args;

        if (!validateNpmPackageName(npmPackageName).validForNewPackages) {
            process.stderr.write(`Invalid npm package name "${npmPackageName}"\n`);
            process.exit(-1);
        }
        validatePublisherName(publisher);
        validatePluginName(pluginName);

        createBoilerplate(npmPackageName, publisher, pluginName, jsMode, process.cwd());
    } else {
        process.stderr.write(`Unsupported command ${cmd}\n`);
        process.exit(-1);
    }
})().catch(e => {
    process.stderr.write(e.stack + "\n");
    process.exit(-1);
});

function createBoilerplate(
    /** @type string */ npmPackageName,
    /** @type string */ publisher,
    /** @type string */ pluginName,
    /** @type boolean */ jsMode,
    /** @type string */ targetPath
) {
    let packageJsonPath = path.join(targetPath, "package.json");
    let webpackConfigPath = path.join(targetPath, "webpack.config.js");

    // HACK: this is a copy paste from @alethio/cms package
    let pluginLibraryName = "__" + (publisher + "/" + pluginName)
        .replace(/\./g, "_")
        .replace(/\//g, "__")
        .replace(/-([a-z])/gi, (match, capture) => capture.toUpperCase());

    fs.copySync(path.join(__dirname, "boilerplate", jsMode ? "js" : "ts"), targetPath);
    fs.writeFileSync(
        packageJsonPath,
        fs.readFileSync(packageJsonPath, { encoding: "utf-8"})
            .replace(/<package_name>/g, npmPackageName)
            .replace(/<publisher>/g, publisher)
            .replace(/<plugin_name>/g, pluginName)
    );
    fs.writeFileSync(
        webpackConfigPath,
        fs.readFileSync(webpackConfigPath, { encoding: "utf-8" })
            .replace(/<library_name>/g, pluginLibraryName)
    );

}

async function installPlugin(
    /** @type string */ targetDir, /** @type string */ pluginArg, /** @type string */ tmpDir,
    devMode = false
) {
    let pacoteOpts = { cache: path.join(tmpDir, "pacote-cache") };

    // Resolve plugin name from spec
    let { name } = await pacote.manifest(pluginArg, pacoteOpts);
    if (!name) {
        process.stderr.write(`Could not resolve plugin manifest for spec "${pluginArg}"\n`);
        process.exit(-1);
    }

    // Extract plugin to a temporary folder
    let pluginTmpPath = path.join(tmpDir, name.replace(/\//g, path.sep));
    await pacote.extract(pluginArg, pluginTmpPath, pacoteOpts);

    // Get plugin manifest
    let { publisher, distDir, mainJsFilename, pluginName, version } = readPluginManifest(pluginTmpPath);

    let pluginSrcDistPath = path.join(pluginTmpPath, distDir);
    let pluginTargetBasePath = getPluginTargetPath(targetDir, publisher, pluginName);
    let pluginTargetPath = devMode ? pluginTargetBasePath : path.join(pluginTargetBasePath, version);
    // clean up from a previous link command
    if (fs.existsSync(pluginTargetBasePath) && fs.lstatSync(pluginTargetBasePath).isSymbolicLink()) {
        fs.removeSync(pluginTargetBasePath);
    }

    fs.copySync(pluginSrcDistPath, pluginTargetPath);

    if (mainJsFilename !== "index.js") {
        fs.renameSync(path.join(pluginTargetPath, mainJsFilename), path.join(pluginTargetPath, "index.js"));
        if (fs.existsSync(path.join(pluginTargetPath, mainJsFilename + ".map"))) {
            fs.renameSync(
                path.join(pluginTargetPath, mainJsFilename + ".map"),
                path.join(pluginTargetPath, "index.js.map")
            );
        }
    }

    process.stdout.write(`Installed to "${pluginTargetPath}".\n`);
}

async function linkPlugin(/** @type string */ targetDir, /** @type string */ pluginPath) {
    let { name, publisher, distDir, mainJsFilename, pluginName} = readPluginManifest(path.resolve(pluginPath));

    if (mainJsFilename !== "index.js") {
        process.stderr.write(`The plugin can only be linked if its main js file is named "index.js" (main js: "${mainJsFilename}", package: ${name}).`);
        process.exit(-1);
    }

    let pluginSrcDistPath = path.resolve(pluginPath, distDir);
    let pluginTargetPath = getPluginTargetPath(targetDir, publisher, pluginName);

    fs.mkdirpSync(path.join(targetDir, publisher));
    fs.removeSync(pluginTargetPath);
    await fs.symlink(pluginSrcDistPath, pluginTargetPath, "junction");

    process.stdout.write(`Symlinked "${pluginSrcDistPath}" to "${pluginTargetPath}".\n`);
}

function getPluginTargetPath(/** @type string */ targetDir, /** @type string */ publisher, /** @type string */ pluginName) {
    return path.join(targetDir, publisher, pluginName);
}

function readPluginManifest(/** @type string */ pluginPath) {
    /** @type {Object.<string, string>} */
    let { name, publisher, main, pluginName, version } = fs.readJsonSync(path.join(pluginPath, "package.json"), { encoding: "utf-8" });
    if (!publisher) {
        process.stderr.write(`Missing "publisher" field in package.json for plugin "${name}".\n`);
        process.exit(-1);
    }
    if (!main) {
        process.stderr.write(`Missing "main" field in package.json for plugin "${name}".\n`);
        process.exit(-1);
    }
    if (name.match(/^@/) && !pluginName) {
        process.stderr.write(`Scoped packages must define a custom "pluginName" field in package.json (package: ${name})\n`);
        process.exit(-1);
    }

    pluginName = pluginName || name;
    validatePluginName(pluginName);

    // Get js files based on "main" field in package.json and copy them to plugins folder
    /** @type string[] */ let mainMatch = main.match(/(?:(.+)\/)?([^/]+\.js)$/);
    if (!mainMatch) {
        process.stderr.write(`Couldn't resolve plugin main field in package.json for plugin package "${name}".\n`);
        process.exit(-1);
    }

    if (!mainMatch[1]) {
        process.stderr.write(`Couldn't resolve js dir for plugin "${name}". ` +
            `"main" field in package.json must point to a package subdirectory containing only the js bundle and its public dependencies\n`);
        process.exit(-1);
    }

    let distDir = mainMatch[1] || ".";
    let mainJsFilename = mainMatch[2];

    let mainJsPath = path.join(pluginPath, distDir, mainJsFilename);
    if (!fs.existsSync(mainJsPath)) {
        process.stderr.write(`Couldn't resolve plugin js entrypoint at "${mainJsPath}"\n`);
        process.exit(-1);
    }

    return {
        pluginName,
        version,
        publisher,
        distDir,
        mainJsFilename
    }
}

function validatePublisherName(/** @type string */ publisher) {
    if (!publisher.match(/^[a-z0-9]+((-|\.)[a-z][a-z0-9]*)*$/)) {
        process.stderr.write(`Publisher name "${publisher}" can consist only of lowercase letter and number groups separated by hyphens (-) or dots (.). Numbers are now allowed immediately after a hyphen (-)\n`);
        process.exit(-1);
    }
}

function validatePluginName(/** @type string */ pluginName) {
    if (!pluginName.match(/^[a-z0-9]+(-[a-z][a-z0-9]*)*$/)) {
        process.stderr.write(`Plugin name "${pluginName}" must contain only lowercase letters, numbers and hyphens (-). Numbers are not allowed immediately after a hyphen.\n`);
        process.exit(-1);
    }
}

function printUsage() {
    process.stdout.write(`Usage:
acp install [{ -t | --target } <target_path>] [{ -d | --dev }] <npm_package_location1> [<npm_package_location2> [...]]
acp link [{ -t | --target } <target_path>] <plugin_dir> [<plugin_dir2] [...]]
acp init [--js] <plugin_npm_package_name> <plugin_publisher> <plugin_name>

Commands:
install         - installs the plugin in a local folder
link            - symlinks the plugin's dist folder to a local folder for development
init            - creates plugin boilerplate in the current folder

Options:
-t | --target   - where to install the plugin (defaults to ./dist/plugins)
-d | --dev      - install plugin in dev mode (doesn't create folder structure for multiple versions)
--js            - should the init command generate JavaScript boilerplate instead of TypeScript boilerplate?

Arguments:
<npm_package_location>  - anything that can be passed to npm install
<plugin_dir>            - a local folder that contains a plugin manifest
`);
}
