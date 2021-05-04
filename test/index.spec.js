/* eslint-env mocha */
'use strict'

const { expect } = require('aegir/utils/chai')
const { convert } = require('../')
const rawCodec = require('multiformats/codecs/raw')
const jsonCodec = require('multiformats/codecs/json')
const { sha256 } = require('multiformats/hashes/sha2')
const { CID } = require('multiformats/cid')
const LegacyCID = require('cids')
const { Buffer } = require('buffer')
const mha = require('multihashing-async')
const mh = mha.multihash
const all = require('it-all')

/**
 * @template T
 * @typedef {import('interface-ipld-format').Format<T>} IPLDFormat<T>
 */

describe('blockcodec-to-ipld-format', () => {
  /** @type {IPLDFormat<Uint8Array>} */
  let raw
  /** @type {IPLDFormat<any>} */
  let json
  /** @type {IPLDFormat<any>} */
  let custom
  /** @type {LegacyCID} */
  let link

  before(async () => {
    raw = convert(rawCodec)
    json = convert(jsonCodec)
    link = await raw.util.cid(Buffer.from('test'))

    custom = convert({
      name: 'custom',
      code: 6787678,
      encode: o => {
        if (o.link) {
          expect(o.link.code).to.exist()
          o.link = true
        }
        return json.util.serialize({ o, l: link.toString() })
      },
      decode: buff => {
        const obj = json.util.deserialize(buff)
        obj.l = link
        if (obj.o.link) obj.link = CID.asCID(link)
        return obj
      }
    })
  })

  it('encode/decode raw', () => {
    const buff = raw.util.serialize(Buffer.from('test'))
    expect(buff).to.equalBytes(Buffer.from('test'))
    expect(raw.util.deserialize(buff)).to.equalBytes(Buffer.from('test'))
  })

  it('encode/decode json', () => {
    const buff = json.util.serialize({ hello: 'world' })
    expect(buff).to.equalBytes(Buffer.from(JSON.stringify({ hello: 'world' })))
    expect(json.util.deserialize(buff)).to.deep.equal({ hello: 'world' })
  })

  it('cid', async () => {
    const cid = await raw.util.cid(Buffer.from('test'))
    expect(cid.version).to.equal(1)
    expect(cid.codec).to.equal('raw')
    const { bytes } = await sha256.digest(Buffer.from('test'))
    expect(cid.multihash).to.equalBytes(bytes)

    const msg = 'not yet supported'
    await expect(raw.util.cid(Buffer.from('test'), { hashAlg: mh.names.md5 })).to.eventually.be.rejectedWith(msg)

    expect(cid).to.be.an.instanceOf(LegacyCID)
  })

  it('resolve', async () => {
    const fixture = custom.util.serialize({
      one: {
        two: {
          hello: 'world'
        },
        three: 3
      }
    })

    expect(custom.resolver.resolve(fixture, 'o/one/two')).to.deep.equal({ value: { hello: 'world' }, remainderPath: '' })
    expect(custom.resolver.resolve(fixture, 'o/one/two/hello')).to.deep.equal({ value: 'world', remainderPath: '' })
    expect(custom.resolver.resolve(fixture, 'l/outside')).to.deep.equal({ value: link, remainderPath: 'outside' })
    expect(() => custom.resolver.resolve(fixture, 'o/two')).to.throw('Not found')
  })

  it('tree', async () => {
    const fixture = custom.util.serialize({
      one: {
        two: {
          hello: 'world'
        },
        three: 3
      }
    })
    const links = ['/o', '/o/one', '/o/one/two', '/o/one/two/hello', '/o/one/three', '/l']
    expect(await all(custom.resolver.tree(fixture))).to.deep.equal(links)
    expect(await all(json.resolver.tree(json.util.serialize('asdf')))).to.deep.equal([])
  })

  it('cid API change', () => {
    const fixture = { link }
    const buff = custom.util.serialize(fixture)
    const decoded = custom.util.deserialize(buff)

    expect(decoded.link).to.be.an.instanceOf(LegacyCID)
    expect(decoded.link.toString()).to.equal(link.toString())
  })
})
