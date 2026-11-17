const {net} = require('electron')
const {Readable} = require('node:stream')

function updateRequest(url, {headers, signal}) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const request = net.request({url, redirect: 'manual', credentials: 'omit'})
    for (const [name, value] of Object.entries(headers)) request.setHeader(name, value)

    let incoming
    const removeAbort = () => signal.removeEventListener('abort', abort)
    const fail = error => {
      removeAbort()
      incoming?.destroy(error)
      reject(error)
    }
    const abort = () => {
      fail(signal.reason)
      request.abort()
    }
    signal.addEventListener('abort', abort, {once: true})
    request.once('error', fail)

    // Let the updater validate the raw Location before opening another request.
    request.once('redirect', (status, _method, _url, responseHeaders) => {
      removeAbort()
      const locations = responseHeaders.location
      const headers = new Headers(locations?.length === 1 ? {location: locations[0]} : undefined)
      resolve({status, headers, body: null})
      request.abort()
    })
    request.once('response', response => {
      incoming = response
      response.once('close', () => {
        removeAbort()
        if (!response.readableEnded) request.abort()
      })
      const body = Readable.toWeb(response, {
        strategy: {highWaterMark: response.readableHighWaterMark, size: chunk => chunk.byteLength},
      })
      const contentRange = response.headers['content-range']
      const headers = new Headers(contentRange ? {'content-range': contentRange} : undefined)
      resolve({status: response.statusCode, headers, body})
    })
    request.end()
  })
}

module.exports = {updateRequest}
