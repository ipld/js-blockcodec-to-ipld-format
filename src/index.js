'use strict'

const { CID } = require('multiformats')
const LegacyCID = require('cids')
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
  const codec = blockCodec.name
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

      if (LegacyCID.isCID(value)) {
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
        if (typeof val === 'object' && !(val instanceof Uint8Array) && !LegacyCID.isCID(val)) {
          yield * _tree(val, [...path, key])
        }
      }
    }
  }

  /** @type {IPLDFormat<T>} */
  const format = {
    // @ts-ignore BlockCodec.code is a number, we need a CodecCode
    codec: blockCodec.code,
    defaultHashAlg,

    util: {
      serialize: (node) => blockCodec.encode(legacyCidToCids(node)),
      deserialize: (buf) => cidsToLegacyCids(blockCodec.decode(buf)),
      cid: async (buf, options = {}) => {
        const opts = {
          cidVersion: options.cidVersion == null ? 1 : options.cidVersion,
          hashAlg: options.hashAlg == null ? defaultHashAlg : options.hashAlg
        }

        const hashName = mh.codes[opts.hashAlg]
        const hash = await mha(buf, hashName)
        const cid = new LegacyCID(opts.cidVersion, codec, hash)

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

/**
 * @template T
 * @param {T} obj
 * @returns {T}
 */
function cidsToLegacyCids (obj) {
  return replaceCids(obj, obj => obj instanceof CID, (obj) => new LegacyCID(obj.bytes))
}

/**
 * @template T
 * @param {T} obj
 * @returns {T}
 */
function legacyCidToCids (obj) {
  return replaceCids(obj, obj => obj instanceof LegacyCID, (obj) => CID.decode(obj.bytes))
}

/**
 * @param {any} obj
 * @param {(obj: any) => boolean} test
 * @param {(obj: CID | LegacyCID) => LegacyCID | CID} convertCid
 */
function replaceCids (obj, test, convertCid) {
  if (test(obj)) {
    return convertCid(obj)
  }

  // skip these types
  if (obj instanceof String ||
      typeof obj === 'string' ||
      typeof obj === 'function' ||
      typeof obj === 'number' ||
      isFinite(obj) ||
      Number.isNaN(obj) ||
      obj === Infinity ||
      obj === -Infinity ||
      obj === true ||
      obj == null ||
      obj instanceof ArrayBuffer ||
      ArrayBuffer.isView(obj)) {
    return obj
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = replaceCids(obj[i], test, convertCid)
    }
  } else {
    for (const key in obj) {
      try {
        obj[key] = replaceCids(obj[key], test, convertCid)
      } catch {}
    }
  }

  return obj
}

module.exports = {
  convert
}
