import {parentPort, workerData} from 'node:worker_threads'
import {searchWorkspace, applyWorkspace} from './workspace.mjs'
import {searchLargeFile} from './large-search.mjs'

try {
  const {action, args} = workerData
  const operation = {search: searchWorkspace, apply: applyWorkspace, largeSearch: searchLargeFile}[action]
  const result = await operation(...args)
  parentPort.postMessage({result})
} catch (error) { parentPort.postMessage({error: error.message}) }
