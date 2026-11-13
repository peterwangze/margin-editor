import {findMatches} from '../shared/text.mjs'
import {findBoostMatches} from '../shared/boost-regex.mjs'

self.onmessage = async ({data: {text, query, range}}) => {
  try {
    if (query.mode !== 'regex') self.postMessage(findMatches(text, query, range))
    else {
      const response = await fetch(new URL('../shared/boost-regex.wasm', import.meta.url))
      if (!response.ok) throw new Error('The bundled Boost regex engine could not be loaded.')
      const module = await WebAssembly.compile(await response.arrayBuffer())
      self.postMessage(findBoostMatches(module, text, query, range))
    }
  }
  catch (error) { self.postMessage({error: error.message}) }
}
