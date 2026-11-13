function imports() {
  const unsupported = () => 8
  return {
    env: {margin_abort() { throw new Error('The Boost regex exceeded an execution limit or rejected the expression.') }},
    wasi_snapshot_preview1: {
      environ_get: () => 0, environ_sizes_get: () => 0,
      fd_close: unsupported, fd_prestat_get: unsupported, fd_prestat_dir_name: unsupported, fd_seek: unsupported, fd_write: unsupported,
      proc_exit() { throw new Error('The Boost regex worker stopped.') },
    },
  }
}

export function findBoostMatches(module, text, query, {limit = 5000, from = 0, to = text.length} = {}) {
  if (!query.needle) return {matches: [], truncated: false}
  if (query.needle.length > 65536 || (query.replacement?.length ?? 0) > 65536) throw new Error('The regex or replacement is too long.')
  const api = new WebAssembly.Instance(module, imports()).exports
  api._initialize()
  const pointers = []
  const write = value => {
    const pointer = api.margin_alloc(Math.max(2, value.length * 2))
    if (!pointer) throw new Error('The regex worker is out of memory.')
    pointers.push(pointer)
    const bytes = new Uint16Array(api.memory.buffer, pointer, value.length)
    for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i)
    return [pointer, value.length]
  }
  const read = (pointer, length) => {
    const units = new Uint16Array(api.memory.buffer, pointer, length)
    const parts = []
    for (let start = 0; start < units.length; start += 8192) parts.push(String.fromCharCode(...units.subarray(start, start + 8192)))
    return parts.join('')
  }
  try {
    const options = (query.caseSensitive ? 0 : 1) | (query.dotAll ? 2 : 0) | (query.whole ? 4 : 0)
    const code = api.margin_regex(...write(text), ...write(query.needle), ...write(query.replacement ?? ''), Math.max(0, Math.min(from, text.length)), Math.max(0, Math.min(to, text.length)), limit, options)
    if (code < 0) throw new SyntaxError(read(api.margin_message(), api.margin_message_length()))
    const result = new Uint32Array(api.memory.buffer, api.margin_results(), api.margin_count() * 4)
    const inserts = api.margin_inserts()
    const matches = []
    for (let i = 0; i < result.length; i += 4) {
      matches.push({from: result[i], to: result[i + 1], insert: read(inserts + result[i + 2] * 2, result[i + 3]).replace(/\r\n?/g, '\n')})
    }
    return {matches, truncated: code === 1}
  } finally { for (const pointer of pointers) api.margin_free(pointer) }
}
