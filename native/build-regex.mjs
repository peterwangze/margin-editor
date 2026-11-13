import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const [, , compiler, boost] = process.argv
assert.ok(compiler && boost, 'Usage: node native/build-regex.mjs <WASI clang++> <Boost.Regex source directory>')
const root = fileURLToPath(new URL('..', import.meta.url))
const target = path.join(root, 'shared/boost-regex.wasm')
const exports = ['alloc', 'free', 'message', 'message_length', 'inserts', 'results', 'count', 'regex']
const command = spawnSync(compiler, [
  '-std=c++20', '-O2', '-fwasm-exceptions', '-mexec-model=reactor', '-Wl,--strip-all,--allow-undefined',
  `-Wl,${exports.map(name => `--export=margin_${name}`).join(',')}`,
  '-I', path.join(boost, 'include'), path.join(root, 'native/regex.cpp'), '-o', target,
], {stdio: 'inherit'})
if (command.error) throw command.error
assert.equal(command.status, 0, 'Compiling Boost.Regex for WebAssembly failed')
const imports = WebAssembly.Module.imports(new WebAssembly.Module(fs.readFileSync(target)))
assert.deepEqual(imports.filter(entry => entry.module === 'env').map(entry => entry.name), ['margin_abort'])
