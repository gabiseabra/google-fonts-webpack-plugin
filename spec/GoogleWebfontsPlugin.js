const should = require("should")
const webpack = require("webpack")
const MemoryFs = require("memory-fs")
const GoogleWebfontPlugin = require("../src")

const webpackConfig = {
	entry: require.resolve("../package.json"),
	output: {
		path: "/",
		filename: "[name].js"
	},
	stats: {
		colors: true
	}
}

describe("GoogleWebfontPlugin", () => {
	let fs, plugin, stats

	before(() => {
		fs = new MemoryFs()
		plugin = new GoogleWebfontPlugin({
			filename: "styles/fonts.css",
			fonts: [
				{
					family: "Source Sans Pro",
					variants: [ "400", "700italic" ]
				},
				{
					family: "Roboto"
				}
			]
		})
		const compiler = webpack(Object.assign({}, webpackConfig, {
			plugins: [ plugin ]
		}))
		compiler.outputFileSystem = fs
		return new Promise((resolve, reject) => {
			compiler.run((err, data) => {
				if(err) {
					reject(err)
				} else {
					stats = data
					console.log(stats.toString(webpackConfig.stats))
					console.log("\n")
					resolve(stats)
				}
			})
		})
	})

	it("adds a chunk to compilation", () => {
		stats.compilation.namedChunks
		.should.have.key(plugin.options.name)
	})

	it("emits font files", () => {
		fs.existsSync("/font/SourceSansPro-Regular.woff").should.be.ok()
		fs.existsSync("/font/Roboto-Regular.woff").should.be.ok()
	})

	it("emits a css file", () => {
		fs.existsSync("/styles/fonts.css").should.be.ok()
		fs.readFileSync("/styles/fonts.css", "utf8")
		.should.containEql("../font/Roboto-Regular.woff")
	})
})
