const _ = require("lodash")
const path = require("path")
const Chunk = require("webpack/lib/Chunk")
const { RawSource } = require("webpack-sources")
const GoogleWebfonts = require("./GoogleWebfonts")
const cssUrl = require("./cssUrl")

const defaults = {
	fonts: undefined,
	name: "fonts",
	apiUrl: undefined,
	formats: undefined,
	filename: "fonts.css",
	path: "font/",
	local: true
}

class GoogleWebfontsPlugin {
	constructor(options) {
		this.options = Object.assign({}, defaults, options)
		this.chunk = new Chunk(this.options.name)
		this.chunk.ids = []
		this.chunk.name = this.options.name
	}

	get api() {
		if(!this._api) {
			this._api = new GoogleWebfonts(this.options.apiUrl)
		}
		return this._api
	}

	fetch() {
		const {
			path,
			fonts,
			apiUrl,
			formats: defaultFormats
		} = this.options
		const css = []
		const files = {}
		const promises = []
		fonts.forEach((fontOptions) => {
			const { family } = fontOptions
			const query = this.api.getFontByFamily(family)
				.then(font => {
					if(!font) {
						throw new Error(`Font family \"${family}\" not found.`)
					}
					return font.select(_.assign(
						fontOptions,
						{ formats: defaultFormats }
					))
				})
			promises.push(
				query.then(q => q.css(path))
				.then(fontCss => css.push(fontCss))
			)
			if(path) {
				promises.push(
					query.then(q => q.assets())
					.then(assets => {
						for(const fileName in assets) {
							files[path + fileName] = assets[fileName]
						}
					})
				)
			}
		})
		return Promise.all(promises).then(() => ({ css, files })).catch(console.error)
	}

	apply(compiler) {
		const { fonts, local, filename: cssFile } = this.options
		compiler.plugin("make", (compilation, cb) => {
			if(local) {
				const addFile = (fileName, source) => {
					this.chunk.files.push(fileName)
					compilation.assets[fileName] = source
				}
				this.fetch().then(({ css, files }) => {
					addFile(cssFile, new RawSource(css.join("\n")))
					for(const fileName in files) {
						addFile(fileName, files[fileName])
					}
					cb()
				})
			} else {
				cb()
			}
			compilation.plugin("html-webpack-plugin-before-html-generation", (data, cb) => {
				if(local) {
					data.assets.css.push(cssFile)
				} else {
					data.assets.css.push(cssUrl(fonts))
				}
				cb(null, data)
			})
			compilation.plugin("additional-assets", cb => {
				compilation.chunks.push(this.chunk)
				compilation.namedChunks[this.options.name] = this.chunk
				cb()
			})
		})
	}
}

GoogleWebfontsPlugin.GoogleWebfonts = GoogleWebfonts

GoogleWebfontsPlugin.cssUrl = cssUrl

module.exports = GoogleWebfontsPlugin
