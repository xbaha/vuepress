const path = require('path')
const fs = require('fs-extra')
const Plugin = require('../plugin-api')
const PluginContext = require('../plugin-api/context')
const resolveOptions = require('./resolveOptions')
const resolveSiteData = require('./resolveSiteData')
const { genRoutesFile, genComponentRegistrationFile } = require('./codegen')
const { writeTemp } = require('./util')

module.exports = async function prepare (sourceDir) {
  // 1. load options
  const options = await resolveOptions(sourceDir)
  const { siteConfig } = options

  // 2. initialize plugin
  const pluginContext = new PluginContext(options)
  const plugin = new Plugin(siteConfig.plugins, pluginContext)
  options.plugin = plugin

  // 3. resolve siteData
  // SiteData must be resolved after the plugin initialization
  // because plugins can expand the sitedata.
  options.siteData = await resolveSiteData(options)
  Object.freeze(options)

  await plugin.hooks.ready.run(options)

  // 4. generate routes & user components registration code
  const routesCode = await genRoutesFile(options)
  const componentCode = await genComponentRegistrationFile(options)

  await writeTemp('routes.js', [
    componentCode,
    routesCode
  ].join('\n'))

  // 5. generate siteData
  const dataCode = `export const siteData = ${JSON.stringify(options.siteData, null, 2)}`
  await writeTemp('siteData.js', dataCode)

  // 5. handle user override
  const overridePath = path.resolve(sourceDir, '.vuepress/override.styl')
  const hasUserOverride = fs.existsSync(overridePath)
  await writeTemp(`override.styl`, hasUserOverride ? `@import(${JSON.stringify(overridePath)})` : ``)

  await plugin.apis.enhanceAppFiles.run()

  return options
}