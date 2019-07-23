// @ts-check
const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const child_process = require("child_process");
const pacote = require("pacote");
const validateNpmPackageName = require("validate-npm-package-name");
const tar = require("tar");
const commander = require('commander');

function wrapErrors(/** @type {(...args: any[]) => Promise<any>} */fn) {
    return (...args) => fn(...args).catch(e => {
        process.stderr.write(e.stack + "\n");
        process.exit(-1);
    });
}

let program = new commander.Command();
program
    .name("acp")
    .description("Alethio CMS Plugin tool\n\nacp [command] -h for help on a specific command.")
    .version(JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf-8")).version);

let defaultTargetPath = path.join("dist", "plugins");

program
    .command("install <npm_package_spec...>")
    .alias("i")
    .description("Installs one or more plugins in a local folder.", {
        "npm_package_spec": "Anything that npm recognizes (npm package, github handle, local path etc.)"
    })
    .option("-t, --target <target_path>", "where to install the plugin", defaultTargetPath)
    .option("-d, --dev", "install plugin in dev mode (no <plugin>/<version> folder nesting)")
    .action(wrapErrors(async (npmPackageSpecs, cmd) => {
        let targetDir = path.resolve(cmd.target);
        let devMode = cmd.dev;

        let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "acp-"));
        try {
            for (let pluginArg of npmPackageSpecs) {
                process.stdout.write(`\n> Install plugin "${pluginArg}":\n\n`);
                await installPlugin(targetDir, pluginArg, tmpDir, devMode);
            }
        } finally {
            fs.emptyDirSync(tmpDir);
            fs.rmdirSync(tmpDir);
        }
    }));

program
    .command("link <plugin_dir...>")
    .description("Installs one or more plugins via symlinks for development purposes.", {
        "plugin_dir": "A local folder that contains a plugin manifest."
    })
    .option("-t, --target <target_path>", "where to link the plugin", defaultTargetPath)
    .action(wrapErrors(async (pluginDirs, cmd) => {
        let targetDir = path.resolve(cmd.target);

        for (let pluginPath of pluginDirs) {
            process.stdout.write(`\n> Link plugin "${pluginPath}":\n\n`);
            await linkPlugin(targetDir, path.resolve(pluginPath));
        }
    }));

program
    .command("uninstall <npm_package_spec...>")
    .alias("remove")
    .description("Uninstall a plugin from the target folder.", {
        "npm_package_spec": "Anything that npm recognizes (npm package, github handle, local path etc.)"
    })
    .option("-t, --target <target_path>", "Path where the plugin is installed. " +
        "Same as the target path provided to 'install' command.", defaultTargetPath)
    .option("-a, --all", "Remove all installed plugin versions, instead of just one.")
    .action(wrapErrors(async (npmPackageSpecs, cmd) => {
        let targetDir = path.resolve(cmd.target);
        let allVersions = cmd.all;

        let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "acp-"));
        try {
            for (let pluginArg of npmPackageSpecs) {
                process.stdout.write(`\n> Uninstall plugin "${pluginArg}":\n\n`);
                await uninstallPlugin(targetDir, pluginArg, tmpDir, allVersions);
            }
        } finally {
            fs.emptyDirSync(tmpDir);
            fs.rmdirSync(tmpDir);
        }
    }));

program
    .command("init <npm_package_name> <publisher> <plugin_name>")
    .description("Generates plugin boilerplate in the current folder. IMPORTANT: Any existing files will be overwritten.", {
        "npm_package_name": "Package name that will be used in the generated package.json. Useful if the plugin will be distributed via npm.",
        "publisher": "A handle identifying the publisher of the plugin. It should be something unique, like the domain-name of an organization or a user's GitHub handle.",
        "plugin_name": "The name of the plugin. The CMS will reference the plugin by this name, together with the publisher (e.g. plugin://publisher/plugin_name)."
    })
    .option("--js", "should the init command generate JavaScript boilerplate instead of TypeScript boilerplate?")
    .action(wrapErrors(async (npmPackageName, publisher, pluginName, cmd) => {
        let jsMode = cmd.js;

        if (!validateNpmPackageName(npmPackageName).validForNewPackages) {
            process.stderr.write(`Invalid npm package name "${npmPackageName}"\n`);
            process.exit(-1);
        }
        validatePublisherName(publisher);
        validatePluginName(pluginName);

        process.stdout.write(`\n> Create boilerplate for plugin "${publisher}/${pluginName}":\n\n`);
        createBoilerplate(npmPackageName, publisher, pluginName, jsMode, process.cwd());
        process.stdout.write("Done.\n");
    }));

program.on("command:*", () => {
    program.outputHelp();
    process.exit(1);
});

program.parse(process.argv);

if (process.argv.length < 3) {
    program.help();
}

function createBoilerplate(
    /** @type string */ npmPackageName,
    /** @type string */ publisher,
    /** @type string */ pluginName,
    /** @type boolean */ jsMode,
    /** @type string */ targetPath
) {
    let packageJsonPath = path.join(targetPath, "package.json");
    let webpackConfigPath = path.join(targetPath, "webpack.config.js");

    if (fs.readdirSync(targetPath).filter(f => !f.match(/^\./)).length) {
        process.stderr.write(`Error: Can't create boilerplate in a non-empty folder.\n`);
        process.exit(1);
    }

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
    /** @type string */ targetDir, /** @type string */ npmPackageSpec, /** @type string */ tmpDir,
    devMode = false
) {
    let pacoteCacheDir = path.join(tmpDir, "pacote-cache");
    let pluginTmpPath = await extractPlugin(npmPackageSpec, tmpDir, pacoteCacheDir);

    let {
        name, publisher, distDir, mainJsFilename, pluginName, version, hasPrepareScript, hasBuildScript
    } = readPluginManifest(pluginTmpPath);

    process.stdout.write(`Resolved plugin spec (plugin: "${publisher}/${pluginName}", version: ${version}, npm: "${name}").\n`);

    let mainJsPath = path.join(pluginTmpPath, distDir, mainJsFilename);
    if (!fs.existsSync(mainJsPath)) {
        // We might be installing from git; attempt to build the plugin first
        process.stdout.write(`WARNING: No main JS file found in plugin package at ` +
            `"${path.join(distDir, mainJsFilename)}". ` +
            `Building the plugin from source...\n`);

        let npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        process.stdout.write(`Running npm install...\n`);
        child_process.spawnSync(npmCmd, ["install"], { cwd: pluginTmpPath, stdio: "inherit" });
        process.stdout.write(`\n`);
        if (!hasPrepareScript && hasBuildScript) {
            process.stdout.write(`Plugin doesn't seem to have a "prepare" script. Doing "npm run build" instead...\n`);
            child_process.spawnSync(npmCmd, ["run", "build"], { cwd: pluginTmpPath, stdio: "inherit" });
            process.stdout.write(`\n`);
        }

        if (!fs.existsSync(mainJsPath)) {
            process.stderr.write(`Couldn't resolve plugin main JS file at "${mainJsPath}"\n`);
            process.exit(-1);
        }
    }

    let pluginSrcDistPath = path.join(pluginTmpPath, distDir);
    let pluginTargetBasePath = getPluginTargetPath(targetDir, publisher, pluginName);
    let pluginTargetPath = devMode ? pluginTargetBasePath : path.join(pluginTargetBasePath, version);

    if (fs.existsSync(pluginTargetBasePath)) {
        // We already have something installed/linked
        if (fs.lstatSync(pluginTargetBasePath).isSymbolicLink()) {
            // clean up from a previous link command
            fs.removeSync(pluginTargetBasePath);
        } else {
            if (devMode) {
                // Clear other installed versions if we're installing in dev mode
                fs.emptyDirSync(pluginTargetBasePath);
                fs.removeSync(pluginTargetBasePath);
            }
        }
    }

    process.stdout.write(`Copying plugin distributables to target directory...\n`);
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

    await fs.emptyDir(pacoteCacheDir);
    await fs.rmdir(pacoteCacheDir);

    process.stdout.write(`\nSuccessfully installed plugin "${publisher}/${pluginName}" to "${pluginTargetPath}".\n`);
}


async function uninstallPlugin(
    /** @type string */ targetDir, /** @type string */ npmPackageSpec, /** @type string */ tmpDir,
    allVersions = false
) {
    let pacoteCacheDir = path.join(tmpDir, "pacote-cache");
    let pluginTmpPath = await extractPlugin(npmPackageSpec, tmpDir, pacoteCacheDir);

    let { name, publisher, pluginName, version } = readPluginManifest(pluginTmpPath);

    process.stdout.write(`Resolved plugin spec (plugin: "${publisher}/${pluginName}", version: ${version}, npm: "${name}").\n`);

    let pluginTargetBasePath = getPluginTargetPath(targetDir, publisher, pluginName);

    if (fs.existsSync(pluginTargetBasePath) && fs.lstatSync(pluginTargetBasePath).isSymbolicLink()) {
        // Plugin was linked, just unlink
        fs.removeSync(pluginTargetBasePath);
        process.stdout.write(`\nUnlinked plugin "${publisher}/${pluginName}".\n`);
    } else {
        /** e.g. publisher/my-plugin/index.js */
        let hasFlatInstall = fs.existsSync(path.join(pluginTargetBasePath, "index.js"));
        /** e.g. publisher/my-plugin/1.0.0/ */
        let versionedPluginPath = path.join(pluginTargetBasePath, version);
        /** e.g. publisher/my-plugin/1.0.0/index.js */
        let hasVersionedInstall = fs.existsSync(path.join(versionedPluginPath, "index.js"));

        if (!fs.existsSync(pluginTargetBasePath) || (!hasFlatInstall && !hasVersionedInstall)) {
            process.stderr.write(`Warning: No plugin installation found at "${pluginTargetBasePath}"\n`);
        } else {
            // Delete the entire plugin folder or the selected version, based on selection
            let pluginInstallPath = allVersions || hasFlatInstall ? pluginTargetBasePath : versionedPluginPath;
            await fs.emptyDir(pluginInstallPath);
            await fs.rmdir(pluginInstallPath);

            // Clean-up plugin folder if empty
            if (
                hasVersionedInstall && fs.existsSync(pluginTargetBasePath) &&
                !fs.readdirSync(pluginTargetBasePath).length
            ) {
                await fs.rmdir(pluginTargetBasePath);
            }

            process.stdout.write(`\nUninstalled plugin "${publisher}/${pluginName}"` +
                (allVersions || hasFlatInstall ? "" : ` (version: ${version})`) + ".\n");
        }
    }

    await fs.emptyDir(pacoteCacheDir);
    await fs.rmdir(pacoteCacheDir);
}

async function extractPlugin(
    /** @type string */npmPackageSpec,
    /** @type string */tmpDir,
    /** @type string */pacoteCacheDir
) {
    let pacoteOpts = {
        cache: pacoteCacheDir,
        // The default dirPacker strips .npmignore'd files, which we don't want to do if installing from git/file,
        // because we will build the plugin locally.
        // See https://github.com/npm/pacote/blob/latest/lib/util/pack-dir.js#L35
        dirPacker(manifest, dir) {
            return tar.c({
                cwd: dir,
                gzip: true,
                portable: true,
                prefix: "package/"
            }, ["."])
        }
    };

    // Resolve plugin name from spec
    process.stdout.write(`Loading plugin manifest...\n`);
    let { name } = await pacote.manifest(npmPackageSpec, pacoteOpts);
    if (!name) {
        process.stderr.write(`Could not resolve plugin manifest for spec "${npmPackageSpec}"\n`);
        process.exit(-1);
    }

    // Extract plugin to a temporary folder
    let pluginTmpPath = path.join(tmpDir, name.replace(/\//g, path.sep));
    await pacote.extract(npmPackageSpec, pluginTmpPath, pacoteOpts);

    return pluginTmpPath;
}

async function linkPlugin(/** @type string */ targetDir, /** @type string */ pluginPath) {
    let { name, publisher, distDir, mainJsFilename, pluginName} = readPluginManifest(pluginPath);

    let mainJsPath = path.join(pluginPath, distDir, mainJsFilename);
    if (!fs.existsSync(mainJsPath)) {
        process.stderr.write(`Couldn't resolve plugin main JS file at "${mainJsPath}"\n`);
        process.exit(-1);
    }

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
    let packageJsonPath = path.join(pluginPath, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
        process.stderr.write(`No package.json manifest found at local path "${packageJsonPath}"\n`);
        process.exit(1);
    }

    /** @type {Object.<string, string>} */
    let { name, publisher, main, pluginName, version, scripts } = fs.readJsonSync(packageJsonPath, { encoding: "utf-8" });
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

    let hasPrepareScript = scripts && !!/** @type any */(scripts).prepare;
    let hasBuildScript = scripts && !!/** @type any */(scripts).build;

    return {
        name,
        pluginName,
        version,
        publisher,
        distDir,
        mainJsFilename,
        hasPrepareScript,
        hasBuildScript
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
