'use strict'

const CID = require('cids')
const mc = require('multicodec')
const mha = require('multihashing-async')
const mh = mha.multihash

/**
 * @template T
 * @typedef {import('interface-ipld-format').Format<T>} IPLDFormat<T>
 */

/**
 * @template Code
 * @template T
 * @typedef {import('multiformats/codecs/interface').BlockCodec<Code, T>} BlockCodec<Code, T>
 */

/**
 * Converts a BlockFormat from the multiformats module into
 * an IPLD Format
 *
 * @template Code
 * @template T
 *
 * @param {BlockCodec<Code, T>} blockCodec
 *
 * @param {object} [options]
 * @param {import('multihashes').HashName} [options.defaultHashAlg]
 * @param {IPLDFormat<T>["resolver"]["resolve"]} [options.resolve]
 * @param {IPLDFormat<T>["resolver"]["tree"]} [options.tree]
 */
function convert (blockCodec, options = {}) {
  // @ts-ignore BlockCodec.name is a string, we need a CodecName
  const codec = mc.getCodeFromName(blockCodec.name)
  const defaultHashAlg = mh.names[options.defaultHashAlg || 'sha2-256']

  const resolve = options.resolve || function (buf, path) {
    let value = blockCodec.decode(buf)
    const entries = path.split('/').filter(x => x)

    while (entries.length) {
      // @ts-ignore
      value = value[/** @type {string} */(entries.shift())]
      if (typeof value === 'undefined') {
        throw new Error('Not found')
      }

      if (CID.isCID(value)) {
        return { value, remainderPath: entries.join('/') }
      }
    }

    return { value, remainderPath: '' }
  }

  /**
   * @type {(node: T, path?: string[]) => Generator<string, void, undefined>}
   */
  const _tree = function * (value, path = []) {
    if (typeof value === 'object') {
      for (const [key, val] of Object.entries(value)) {
        yield ['', ...path, key].join('/')
        if (typeof val === 'object' && !Buffer.isBuffer(val) && !CID.isCID(val)) {
          yield * _tree(val, [...path, key])
        }
      }
    }
  }

  /** @type {IPLDFormat<T>} */
  const format = {
    codec,
    defaultHashAlg,

    util: {
      serialize: (node) => blockCodec.encode(node),
      deserialize: (buf) => blockCodec.decode(buf),
      cid: async (buf, options = {}) => {
        const opts = {
          cidVersion: options.cidVersion == null ? 1 : options.cidVersion,
          hashAlg: options.hashAlg == null ? defaultHashAlg : options.hashAlg
        }

        const hashName = mh.codes[opts.hashAlg]
        const hash = await mha(buf, hashName)
        const cid = new CID(opts.cidVersion, codec, hash)

        return cid
      }
    },

    resolver: {
      resolve,
      tree: function * (buf) {
        yield * (options.tree ? options.tree(buf) : _tree(blockCodec.decode(buf)))
      }
    }
  }

  return format
}

module.exports = {
  convert
}
