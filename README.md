# blockcodec-to-ipld-format <!-- omit in toc -->

> Convert a [BlockCodec](https://github.com/multiformats/js-multiformats/blob/master/src/codecs/interface.ts#L21) from the [multiformats](https://www.npmjs.com/package/multiformats) module into an
[IPLD Format](https://www.npmjs.com/package/interface-ipld-format) for use with the [IPLD](https://www.npmjs.com/package/ipld) module.

## Table of contents <!-- omit in toc -->

- [Install](#install)
  - [Use](#use)
- [API](#api)
- [Contribute](#contribute)
- [License](#license)

## Install

```console
$ npm i blockcodec-to-ipld-format
```

### Use

```javascript
const { convert } = require('blockcodec-to-ipld-format')
const dagCbor = require('@ipld/dag-cbor')

const format = convert(dagCbor)

// use interface-ipld-format methods
console.info(format.codec)
console.info(format.defaultHashAlg)
console.info(format.util.serialize({ foo: 'bar' }))
// etc..
```

## API

https://ipld.github.io/js-blockcodec-to-ipld-format/

## Contribute

Feel free to join in. All welcome. Open an [issue](https://github.com/ipld/blockcodec-to-ipld-format/issues)!

This repository falls under the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)

## License

[MIT](LICENSE)
