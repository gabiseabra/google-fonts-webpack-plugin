const API_URL = "https://fonts.googleapis.com/css"

function getVariantName(variant) {
	if(variant === "regular") {
		return "400"
	} else if(variant === "italic") {
		return "400i"
	}
	const weight = parseInt(variant.substr(0, 3)) || 400
	if(/italic$/.test(variant)) {
		return `${weight}i`
	}
	return weight.toString()
}

module.exports = function googleFontsUrl(fonts, apiUrl = API_URL) {
	const fontQueries = []
	fonts.forEach(({ family, subsets, variants }) => {
		let query = family.replace(" ", "+")
		if(variants) {
			query += ":" + variants.map(name => getVariantName(name)).join(",")
		}
		if(subsets) {
			query += "&subset=" + subsets.join(",")
		}
		fontQueries.push(query)
	})
	return `${apiUrl}?family=${fontQueries.join("|")}`
}
