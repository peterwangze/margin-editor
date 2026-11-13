import {inspectText, planCleanup} from '../shared/inspect-text.mjs'

let text, scopes, partialLastLine
self.onmessage = ({data}) => {
  try {
    if (data.init) ({text, scopes, partialLastLine} = data.init)
    else {
      const {id, scope, options} = data
      const ranges = scopes[scope]
      if (options) self.postMessage({id, plan: planCleanup(text, ranges, options, partialLastLine)})
      else self.postMessage({id, stats: inspectText(text, ranges)})
    }
  } catch (error) { self.postMessage({id: data.id, error: error.message}) }
}
