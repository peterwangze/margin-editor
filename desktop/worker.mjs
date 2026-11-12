import {parentPort, workerData} from 'node:worker_threads'
import {searchWorkspace, applyWorkspace} from './workspace.mjs'

try {
  const {action, args} = workerData
  const result = await (action === 'search' ? searchWorkspace(...args) : applyWorkspace(...args))
  parentPort.postMessage({result})
} catch (error) { parentPort.postMessage({error: error.message}) }
