const _ = require("lodash")
const path = require("path")
const Chunk = require("webpack/lib/Chunk")
const {
    RawSource
} = require("webpack-sources")
const GoogleWebfonts = require("./GoogleWebfonts")
const cssUrl = require("./cssUrl")

const defaults = {
    fonts: undefined,
    name: "fonts",
    apiUrl: undefined,
    formats: undefined,
    filename: "fonts.css",
    path: "font",
    local: true,
    noLocalInCss: false
}

const pluginSignature = {
	name: "GoogleWebfontsPlugin"
};

class GoogleWebfontsPlugin {
    constructor (options) {
        this.options = Object.assign({}, defaults, options)
        this.chunk = new Chunk(this.options.name)
        this.chunk.ids = []
        this.chunk.name = this.options.name
    }

    get api () {
        if (!this._api) {
            this._api = new GoogleWebfonts(this.options.apiUrl)
        }
        return this._api
    }

    fetch () {
        const {
            fonts,
            apiUrl,
            path: fontsPath,
            filename: cssFile,
            formats: defaultFormats,
            noLocalInCss: noLocalInCss
        } = this.options;
        const compareCss = (a, b) => (a.id.localeCompare(b.id));
        const fontsCss = [];
        const files = {};
        const promises = [];

        fonts.forEach((fontOptions) => {
            const {
                family
            } = fontOptions;
            const query = this.api.getFontByFamily(family)
                .then(font => {
                    if (!font) {
                        throw new Error(`Font family \"${family}\" not found.`);
                    }
                    return font.select(_.assign(
                        fontOptions, {
                            formats: defaultFormats,
                            noLocalInCss
                        }
                    ));
                });

            promises.push(
                query.then(selection => {
                    return selection.css(fontsPath).then((css) => {
                        fontsCss.push({
                            css,
                            id: selection.font.id
                        })
                    });
                })
            );
            if (fontsPath) {
                promises.push(
                    query.then(q => q.assets())
                    .then(assets => {
                        for (const fileName in assets) {
                            const fontPath = path.dirname(cssFile)
                            const realFileName = path.join(fontPath, fontsPath, fileName)
                            files[realFileName] = assets[fileName]
                        }
                    })
                );
            }
        });
        return Promise.all(promises)
            .then(() => {
                fontsCss.sort(compareCss);
                const css = fontsCss.map(font => font.css).join("\n");
                return {
                    css,
                    files
                };
            });
    }

    apply (compiler) {
        const {
            fonts,
            local,
            filename: cssFile
        } = this.options

		const htmlWebpackPluginBeforeHtmlGeneration = (data, cb) => {
            const publicPath = data.assets.publicPath
            if (local && (publicPath.indexOf("://") !== -1 || publicPath.indexOf(":") !== -1)) {
                data.assets.css.push(publicPath + cssFile);
            }
            else if (local) {
                data.assets.css.push(path.posix.join(publicPath, cssFile));
            }
            else {
                data.assets.css.push(cssUrl(fonts));
            }
            if (typeof cb === "function") {
                cb(null, data)
            }
        };

        const make = (compilation, cb) => {

			const additionalAssets = (cb) => {
                const isWebpack5 = typeof compilation.chunks.add !== 'undefined';
                if (isWebpack5) {
                    compilation.chunks.add(this.chunk);
                } else {
                    compilation.chunks.push(this.chunk);
                }

	            compilation.namedChunks.set(this.options.name, this.chunk);
	            cb();
	        };

            if (local) {
                const addFile = (fileName, source) => {
                    const isWebpack5 = typeof this.chunk.files.add !== 'undefined';
                    if (isWebpack5) {
                        this.chunk.files.add(fileName)
                    } else {
                        this.chunk.files.push(fileName)
                    }

                    compilation.assets[fileName] = source
                }
                this.fetch().then(({
                    css,
                    files
                }) => {
                    addFile(cssFile, new RawSource(css));
                    for (const fileName in files) {
                        addFile(fileName, files[fileName]);
                    }
                    cb();
                })
            } else {
                cb();
            }
            if (compilation.hooks) {
                if (compilation.hooks.htmlWebpackPluginBeforeHtmlGeneration) {
            	   compilation.hooks.htmlWebpackPluginBeforeHtmlGeneration.tapAsync(pluginSignature, htmlWebpackPluginBeforeHtmlGeneration);
                }
            	compilation.hooks.additionalAssets.tapAsync(pluginSignature, additionalAssets);
            } else {
	            compilation.plugin("html-webpack-plugin-before-html-generation", htmlWebpackPluginBeforeHtmlGeneration);
	            compilation.plugin("additional-assets", additionalAssets);
	        };
        };

 		if (compiler.hooks) {
			compiler.hooks.make.tapAsync(pluginSignature, make);
		} else {
        	compiler.plugin("make", make);
        }
    }
}

GoogleWebfontsPlugin.GoogleWebfonts = GoogleWebfonts

GoogleWebfontsPlugin.cssUrl = cssUrl

module.exports = GoogleWebfontsPlugin
