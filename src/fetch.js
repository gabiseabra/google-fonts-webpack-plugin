// Based on https://github.com/bitinn/node-fetch/issues/195#issue-187810893 by @gajus
const fetch = require('node-fetch')
const HttpsProxyAgent = require('https-proxy-agent')

module.exports = (url, options = {}) => {
  const instanceOptions = {
    ...options
  }

  if (!options.agent && process.env.HTTP_PROXY) {
    instanceOptions.agent = new HttpsProxyAgent(process.env.HTTP_PROXY)
  }

  return fetch(url, instanceOptions)
}