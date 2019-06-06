import { IPlugin } from "plugin-api";

const plugin: IPlugin = {
    init(config, api, logger, publicPath) {
        __webpack_public_path__ = publicPath;

        // Add module, page definitions and others here
    },

    getAvailableLocales() {
        return ["en-US"];
    },

    async loadTranslations(locale: string) {
        return await import("./translation/" + locale + ".json");
    }
};

// tslint:disable-next-line:no-default-export
export default plugin;
