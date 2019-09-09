const plugin = {
    init(config, api, logger, publicPath) {
        __webpack_public_path__ = publicPath;

        // Add module, page definitions and others here
    },

    getAvailableLocales() {
        return ["en-US"];
    },

    async loadTranslations(locale) {
        return await import("./translation/" + locale + ".json");
    }
};

export default plugin;

export const manifest = __plugin_manifest__;
