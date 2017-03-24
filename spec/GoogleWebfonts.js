const should = require("should")
const GoogleWebfonts = require("../src/GoogleWebfonts")

describe("GoogleWebfonts", () => {
	let api

	before(() => {
		api = new GoogleWebfonts()
	})

	describe("#getFonts()", () => {
		it("returns a list of fonts", () => (
			api.getFonts()
				.then(fonts => {
					fonts.should.be.Array()
					.and.should.not.be.empty
				})
		))
	})

	describe("#getFontById(id)", () => {
		it("returns a font by id", () => (
			api.getFontById("lato")
				.then(font => {
					font.should.be.instanceOf(GoogleWebfonts.Font)
				})
		))
	})

	describe("#getFontByFamily(family)", () => {
		it("returns a font by family", () => (
			api.getFontByFamily("Open Sans")
				.then(font => {
					font.should.be.instanceOf(GoogleWebfonts.Font)
				})
		))
	})

	describe("Font", () => {
		let promise

		before(() => {
			promise = api.getFontById("open-sans")
		})

		describe("#getName(variant?)", () => {
			it("returns the font's file name", () => (
				promise.then(font => {
						font.getName().should.equal("OpenSans")
						font.getName("700").should.equal("OpenSans-Bold")
					})
			))
		})

		describe("#info", () => {
			it("returns the full font info", () => (
					promise.then(font => font.info())
						.then(info => {
							info.should.be.an.Object()
						})
			))
		})

		describe("#select", () => {
			it("returns a downloader", () => (
					promise.then(font => {
						font.select().should.be.instanceOf(GoogleWebfonts.Selection)
					})
			))
		})
	})

	describe("Selection", () => {
		let promise

		before(() => {
			promise = api.getFontById("open-sans")
				.then(font => font.select({
					variants: [ "400", "700italic" ],
					formats: [ "woff", "woff2" ]
				}))
		})

		describe("#css", () => {
			it("returns font-face css", () => (
				promise.then(query => query.css())
					.then(css => {
						css.should.containEql("@font-face")
					})
			))
		})

		describe("#download", () => {
			it("fetches font files", () => (
				promise.then(query => query.download())
					.then(res => {
						res.status.should.equal(200)
					})
			))
		})

		describe("#files", () => {
			it("returns a list of font files", () => (
				promise.then(query => query.files())
					.then(files => {
						files.should.have.keys(
							"OpenSans-Regular.woff",
							"OpenSans-Regular.woff2",
							"OpenSans-BoldItalic.woff",
							"OpenSans-BoldItalic.woff2"
						).and.should.not.have.keys(
							"OpenSans-Regular.eot",
							"OpenSans-Regular.ttf"
						)
					})
			))
		})

		describe("#assets", () => {
			it("returns a list of font files", () => (
				promise.then(query => query.assets())
					.then(assets => {
						assets.should.have.keys(
							"OpenSans-Regular.woff",
							"OpenSans-Regular.woff2",
							"OpenSans-BoldItalic.woff",
							"OpenSans-BoldItalic.woff2"
						).and.should.not.have.keys(
							"OpenSans-Regular.eot",
							"OpenSans-Regular.ttf"
						)
					})
			))
		})
	})
})
