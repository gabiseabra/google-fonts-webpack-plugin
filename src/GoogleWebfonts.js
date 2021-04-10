const _ = require("lodash")
const path = require("path")
const yauzl = require("yauzl")
const fetch = require("node-fetch")
const os = require("os")
const md5 = require("md5")
const fs = require("fs")
const { RawSource } = require("webpack-sources")
const FontTypes = require("./FontTypes")

const API_URL = "https://google-webfonts-helper.herokuapp.com/api/fonts"

const FONT_SRC = (font, format) => `url("${font}")${format ? ` format("${format}")` : ""}`

const FONT_FACE = ({ fontFamily, fontStyle, fontWeight, display, src, fallback }) => `
@font-face {
	font-family: ${fontFamily};
	font-style: ${fontStyle};
	font-weight: ${fontWeight};
	font-display: ${display};
	${fallback ? `src: ${fallback};` : ""}
	${src.length ? `src: ${src.join(",\n\t\t")};` : ""}
}
`

function tmpFile(filename) {
	return path.join(os.tmpdir(), filename);
}

function getVariantCss({ variant, info, font, formats, display, fontsPath, noLocalInCss }) {
	const src = !!noLocalInCss
		? []
		: Object.prototype.hasOwnProperty.call(info, 'local')
			? info.local.map(fileName => `local("${fileName}")`)
			: ["local("+info.fontFamily+")"]
	let fallback
	formats.forEach(ext => {
		if(ext in info) {
			const url = (
				typeof fontsPath !== "undefined" ?
				`./${fontsPath}/${font.getName(variant)}.${ext}` :
				info[ext]
			)
			const format = FontTypes[ext]
			src.push(FONT_SRC(url, format))
			if(ext === "eot") {
				fallback = FONT_SRC(url)
			}
		}
	})
	return (
		`/* === ${font.family} - ${variant} */` +
		FONT_FACE(_.assign({ src, fallback, display }, info))
	)
}

class Selection {
	constructor(font, query, info) {
		this.font = font
		this.query = {
			subsets: query.subsets || font.defaults.subsets,
			variants: query.variants || font.defaults.variants,
			formats: query.formats || _.keys(FontTypes),
			display: query.display || "swap"
		}
		this.query.variants = this.query.variants.map(value => {
			switch(value) {
				case "400": return "regular"
				case "400italic": return "italic"
				default: return value
			}
		})
		this.noLocalInCss = query.noLocalInCss
	}

	css(fontsPath) {
		const { font, query: { subsets, variants, formats, display }, noLocalInCss } = this
		return font.info(subsets)
			.then(info => {
				const css = []
				variants.forEach(variant => {
					const variantInfo = info.variants.filter(node => node.id === variant).pop()
					if(variantInfo) {
						css.push(getVariantCss({
							info: variantInfo,
							formats,
							variant,
							font,
							display,
							fontsPath,
							noLocalInCss
						}))
					}
				})
				return css.join("\n")
			})
	}

	getZipURL() {
		const { font } = this
		const { subsets, variants, formats } = this.query
		let url = `${font.url}?download=zip`
		url += "&subsets=" + subsets.join(",")
		url += "&variants=" + variants.join(",")
		if(formats) {
			url += "&formats=" + formats.join(",")
		}
		return url
	}

	download() {
		if(this._response) {
			return Promise.resolve(this._response)
		}
		return fetch(this.getZipURL())
			.then(response => {
				if(response.status !== 200) {
					throw new Error(response.statusText)
				}
				this._response = response
				return response
			})
	}

	// Download zip, but return cached if there is one
	downloadWithCache() {
		const url = this.getZipURL()
		const cacheFilePath = tmpFile("google-fonts-webpack-" + md5(url) + ".zip")
		if (fs.existsSync(cacheFilePath)) {
			return Promise.resolve(fs.readFileSync(cacheFilePath))
		} else {
			return new Promise((resolve, reject) => {
				this.download()
					.then(response => response.buffer())
					.then(buffer => {
						fs.writeFile(cacheFilePath, buffer, (err) => {
							if (err) console.log("Couldn't cache file")
						})
						resolve(buffer)
					})
			})
		}
	}

	files() {
		if(this._files) {
			return Promise.resolve(this._files)
		}
		return this.downloadWithCache()
			.then(buffer => new Promise((resolve, reject) => {
				this._files = {}
				yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipFile) => {
					if(err) {
						reject(err)
					}
					const next = () => zipFile.readEntry()
					zipFile
						.on("error", reject)
						.on("end", () => resolve(this._files))
						.on("entry", entry => {
							if(/\/$/.test(entry.fileName)) next()
							const ext = path.extname(entry.fileName).slice(1)
							const variant = entry.fileName.match(/\-([a-z0-9]+)\..*$/)[1]
							const fileName = `${this.font.getName(variant)}.${ext}`
							zipFile.openReadStream(entry, (err, stream) => {
								if(err) reject(err)
								const buffer = []
								stream.on("data", data => buffer.push(data))
								stream.on("end", () => {
									this._files[fileName] = Buffer.concat(buffer)
									next()
								})
							})
						})
					zipFile.readEntry()
				})
			}))
	}

	assets() {
		return this.files()
			.then(files => {
				const assets = {}
				for(const fileName in files) {
					assets[fileName] = new RawSource(files[fileName])
				}
				return assets
			})
	}
}

class Font {
	constructor(url, { id, family, variants, formats, display, defSubset, defVariant }) {
		this.apiUrl = url
		this.id = id
		this.family = family
		this.variants = variants
		this.formats = formats
		this.display = display
		this.defaults = {
			subsets: [ defSubset ],
			variants: [ defVariant ]
		}
		this.getName = this.getName.bind(this)
	}

	get url() { return `${this.apiUrl}/${this.id}` }

	getName(variant) {
		let name = _.chain(this.family).camelCase().upperFirst().value()
		if(variant) {
			const weight = parseInt(variant.substr(0, 3))
			let suffix = "Regular"
			switch(weight) {
				case 100: suffix = "Thin"; break;
				case 200: suffix = "ExtraLight"; break;
				case 300: suffix = "Light"; break;
				case 400: suffix = "Regular"; break;
				case 500: suffix = "Medium"; break;
				case 600: suffix = "SemiBold"; break;
				case 700: suffix = "Bold"; break;
				case 800: suffix = "ExtraBold"; break;
				case 900: suffix = "Black"; break;
			}
			if(/italic$/.test(variant)) {
				suffix = (suffix === "Regular" ? "Italic" : `${suffix}Italic`)
			}
			name += `-${suffix}`
		}
		return name
	}

	info(subsets) {
		if(this._info) {
			return Promise.resolve(this._info)
		}
		let url = this.url + "?"
		if(subsets) {
			url += "subsets=" + subsets.join(",")
		}
		return fetch(url)
			.then(response => {
				if(response.status !== 200) {
					throw new Error(response.statusText)
				}
				return response.json()
			})
			.then(info => {
				this._info = info
				return info
			})
	}

	select(options = {}) {
		return new Selection(this, options)
	}
}

class GoogleWebfonts {
	constructor(apiUrl = API_URL) {
		this.url = apiUrl
	}

	getFonts() {
		if(this._fonts) {
			return Promise.resolve(this._fonts)
		} else {
			return fetch(this.url)
				.then(response => {
					if(response.status !== 200) {
						throw new Error(response.statusText)
					}
					return response.json()
				})
				.then(fonts => fonts.map(font => new Font(this.url, font)))
				.then(fonts => {
					this._fonts = fonts
					return fonts
				})
		}
	}

	getFontById(id) {
		return this.getFonts()
			.then(fonts => fonts.filter(font => font.id === id).pop())
	}

	getFontByFamily(family) {
		return this.getFonts()
			.then(fonts => fonts.filter(font => font.family.toLowerCase() === family.toLowerCase()).pop())
	}
}

GoogleWebfonts.Font = Font

GoogleWebfonts.Selection = Selection

module.exports = GoogleWebfonts
