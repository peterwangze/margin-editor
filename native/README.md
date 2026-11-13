# Boost.Regex engine

The checked-in `shared/boost-regex.wasm` is built from this adapter, [Boost.Regex 1.92.0](https://github.com/boostorg/regex/tree/boost-1.92.0), and [WASI SDK 27](https://github.com/WebAssembly/wasi-sdk/releases/tag/wasi-sdk-27). The Boost version follows the [Notepad++ v8.9.9.1 build instructions](https://github.com/notepad-plus-plus/notepad-plus-plus/blob/v8.9.9.1/BUILD.md). The Boost source ZIP SHA-256 is `7b3d16df2b929a1593e5831624a3c81ed3143f12335f38251dd98ea07cc81455`. Windows, macOS, and Linux packages use the same module. See [third-party licenses](../assets/licenses).

To rebuild from the extracted SDK and source directories, pass the SDK's `clang++` executable and the extracted `regex-boost-1.92.0` directory:

```sh
node native/build-regex.mjs /path/to/wasi-sdk/bin/clang++ /path/to/regex-boost-1.92.0
npm test
```

The engine uses UTF-16 offsets and Boost's Perl matching and extended replacement formatting. It searches Margin's normalized LF text. Locale-specific behavior, regexes that depend on seeing raw CRLF, and whole-file regex for paged documents require separate compatibility work. The worker owns each execution and has a deadline. The module receives only strings and has no filesystem or network imports.
