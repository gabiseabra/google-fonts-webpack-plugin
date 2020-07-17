const should = require("should");
const webpack = require("webpack");
const MemoryFs = require("memory-fs");
const nodeFS = require("fs");
const os = require("os");
const GoogleWebfontPlugin = require("../src");

const webpackConfig = {
	entry: require.resolve("../package.json"),
	output: {
		path: "/",
		filename: "[name].js"
	},
	stats: {
		colors: true
	}
};

describe("GoogleWebfontPlugin", () => {
	let fs, plugin, stats

	//before
	it("does something", () => {
		fs = new MemoryFs();
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
		});
		const compiler = webpack(Object.assign({}, webpackConfig, {
			plugins: [ plugin ]
		}));
		compiler.outputFileSystem = fs
		return new Promise((resolve, reject) => {
			compiler.run((err, data) => {
				if(err) {
					console.log(err);
					reject(err)
				} else {
					stats = data
					console.log(stats.toString(webpackConfig.stats))
					console.log("\n")
					resolve(stats)
				}
			})
		});
	});

	it("adds a chunk to compilation", () => {
		Array.from(stats.compilation.namedChunks.keys()).should.containEql(plugin.options.name);
	});

	it("emits font files", () => {
		fs.existsSync("/styles/font/SourceSansPro-Regular.woff").should.be.ok();
		fs.existsSync("/styles/font/Roboto-Regular.woff").should.be.ok();
	});

	it("emits a css file", () => {
		fs.existsSync("/styles/fonts.css").should.be.ok();
		fs.readFileSync("/styles/fonts.css", "utf8").should.containEql("./font/Roboto-Regular.woff")
	});

	it("downloaded files are cached", () => {
		nodeFS.readdirSync(os.tmpdir()).filter(fn => {
			return fn.endsWith(".zip") && fn.startsWith("google-fonts-webpack")
		}).should.not.be.exactly(0)
	})
});
