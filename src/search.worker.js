import {findMatches} from '../shared/text.mjs'

self.onmessage = ({data: {text, query, range}}) => {
  try { self.postMessage(findMatches(text, query, range)) }
  catch (error) { self.postMessage({error: error.message}) }
}
