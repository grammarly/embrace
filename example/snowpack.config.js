/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  root: './',
  mount: {
    public: { url: '/', static: true },
    src: { url: '/dist' }
  },
  plugins: [
    '@snowpack/plugin-react-refresh',
    '@snowpack/plugin-dotenv',
    '@snowpack/plugin-typescript'
  ],
  routes: [
    /* Enable an SPA Fallback in development: */
    // {"match": "routes", "src": ".*", "dest": "/index.html"},
  ],
  optimize: {
    bundle: true,
    minify: true,
    treeshake: true,
    target: 'es2020'
  },
  packageOptions: {
    // we need nodejs polyfill due to dependency on "path" module in "content-disposition" module
    polyfillNode: true
  },
  devOptions: {
    /* ... */
  },
  buildOptions: {
    /* ... */
  }
}
