# Bundled PNG codec

Technique tools ship the unmodified `lib/*.js` files from **pngjs 7.0.0**, plus its MIT license. Its minimal `package.json` declares the original name/version/license and CommonJS boundary; no npm lifecycle scripts or development dependencies are shipped.

- Upstream: https://github.com/pngjs/pngjs
- Pinned source: https://registry.npmjs.org/pngjs/-/pngjs-7.0.0.tgz
- Verified npm integrity: `sha512-LKWqWJRhstyYo9pGvgor/ivk2w94eSjE3RGVuzLGlr3NmD8bf7RcYGze1mNdEHRP6TRP6rMuDHk5t44hnTRyow==`
- License: [pngjs/LICENSE](pngjs/LICENSE)

This is a pure-JavaScript codec using Node.js built-ins. End users do not need `npm install`, Python or a native raster binary. The client checks input bytes, dimensions, bit depth, interlace and animation before decoding. Only single-frame, non-interlaced, 8-bit PNG inputs are accepted by technique tools; ordinary Generate/Edit output saving still preserves the API's actual image format.

Codec changes are executable skill updates, never content-only sync. The upstream license applies to this dependency, not automatically to the rest of the project.
