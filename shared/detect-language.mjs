export const languageSampleLimit = 12 * 1024

const interpreters = [
  [/^(?:ba|da|k|z)?sh$/, 'Shell'],
  [/^python(?:\d+(?:\.\d+)?)?$/, 'Python'],
  [/^(?:node|nodejs|bun)$/, 'JavaScript'],
  [/^ruby(?:\d+(?:\.\d+)?)?$/, 'Ruby'],
  [/^perl$/, 'Perl'],
  [/^php$/, 'PHP'],
  [/^lua(?:\d+(?:\.\d+)?)?$/, 'Lua'],
  [/^(?:pwsh|powershell)$/, 'PowerShell'],
]

const htmlTag = /^(?:html|head|body|title|main|section|article|header|footer|nav|div|span|p|h[1-6]|ul|ol|li|table|form|label|button|script|style|template)$/i
const verilogModule = /^(?:module|macromodule)[ \t]+(?:[A-Za-z_][\w$]*|\\\S+)\s*(?:;|#\s*\(|\((?:\s*(?:input|output|inout)\b|[^;]*?\)\s*;|\s*$))/
const verilogDirective = /^`(?:timescale\s+\d+\s*(?:[munpf]s|s)\s*\/\s*\d+\s*(?:[munpf]s|s)\b|default_nettype\s+(?:none|wire)\b)/
const verilogPreamble = /^(?:`(?:include|define|undef|ifdef|ifndef|elsif|else|endif)\b[^\r\n]*(?:\r?\n|$)\s*)+/
const systemVerilogBlock = /^(?:always_(?:ff|comb|latch)\s*(?:@|begin\b)|typedef\s+(?:struct\s+packed|enum\b)|(?:assert|assume|cover)\s+property\s*\()/
const logicType = /(?:^|[\r\n,(])\s*(?:(?:input|output|inout)\s+)?logic\s+(?:\[[^\]\r\n]+\]\s*)?[A-Za-z_][\w$]*\s*(?=[;,)=])/m

function languageFromShebang(sample) {
  if (!sample.startsWith('#!')) return null
  const [path, ...args] = sample.slice(2).split(/\r?\n/, 1)[0].trim().split(/\s+/)
  const executable = path.split('/').at(-1)
  const interpreter = executable === 'env' ? args.find(argument => !argument.startsWith('-') && !argument.includes('=')) : executable
  return interpreters.find(([pattern]) => pattern.test(interpreter ?? ''))?.[1] ?? null
}

function languageFromMarkup(sample) {
  const markup = sample.replace(/^(?:<!--[^]*?-->\s*)+/, '')
  if (/^<!doctype\s+html\b|^<html(?=[\s>])/i.test(markup)) return 'HTML'
  if (/^<\?xml(?:\s|\?>)/.test(markup)) return 'XML'

  const opening = markup.match(/^<([A-Za-z_][\w.:-]*)(?:\s[^<>]*)?>/)
  if (!opening) return null
  const [, tag] = opening
  if (new RegExp(`</${tag.replaceAll('.', '\\.')}\\s*>`, 'i').test(markup)) {
    return htmlTag.test(tag) ? 'HTML' : 'XML'
  }
  if (/^<(?:meta|link|img|input)\s+[^<>]*=/.test(markup)) return 'HTML'
  return null
}

function looksLikeJson(sample) {
  if (!/^[{[]/.test(sample)) return false
  // Recognize the start of a member in an unfinished or truncated object.
  if (/^\{\s*"(?:[^"\\\r\n]|\\[^\r\n])*"\s*:\s*(?:["{[]|-?\d|true\b|false\b|null\b)/.test(sample)) return true
  if (sample.endsWith(']')) {
    try {
      const value = JSON.parse(sample)
      return Array.isArray(value) && value.length > 0 && (value.length > 1 || typeof value[0] !== 'number')
    } catch { return false }
  }
  return false
}

function languageFromHdl(source) {
  const code = source.replace(verilogPreamble, '')
  if (systemVerilogBlock.test(code) || /^logic\s+\[[^\]\r\n]+:[^\]\r\n]+\]\s*[A-Za-z_][\w$]*\s*[;=]/.test(code)) return 'SystemVerilog'
  const scope = code.match(/^(interface|package|program)\s+[A-Za-z_][\w$]*\s*;/)
  if (scope && new RegExp(`^\\s*end${scope[1]}\\b`, 'm').test(code)) return 'SystemVerilog'
  if (verilogModule.test(code) || verilogDirective.test(code)) {
    return logicType.test(code) || /\b(?:always_ff|always_comb|always_latch)\s*(?:@|begin\b)/.test(code) ? 'SystemVerilog' : 'Verilog'
  }
  if (/^(?:assign\s+[A-Za-z_][\w$]*(?:\[[^\]\r\n]+\])?\s*=[^=;\r\n][^;]*;|always\s*@\s*(?:\*|\()|wire\s+\[[^\]\r\n]+:[^\]\r\n]+\]\s*[A-Za-z_][\w$]*\s*[;=])/.test(code)) return 'Verilog'
  return null
}

function languageFromCode(sample) {
  // Mask C-style comments and double-quoted strings when looking for HDL constructs.
  const code = sample.replace(/\/\*[^]*?(?:\*\/|$)|\/\/[^\r\n]*|"(?:[^"\\\r\n]|\\[^\r\n])*"/g,
    token => token.replace(/[^\r\n]/g, ' ')).trim()
  const hdl = languageFromHdl(code)
  if (hdl) return hdl

  if (/^<\?php(?:\s|$)/.test(sample)) return 'PHP'
  if (/^\s*(?:async\s+)?def\s+[A-Za-z_]\w*\s*\([^\r\n]*\)\s*(?:->[^:\r\n]+)?\s*:/m.test(code) ||
      /^\s*if\s+__name__\s*==\s*['"]__main__['"]\s*:/m.test(sample)) return 'Python'

  if (/^\s*#\s*include\s*<[\w./-]+>/m.test(code)) {
    return /(?:<iostream>|<vector>|<string>|\bstd::)/.test(code) ? 'C++' : 'C'
  }
  if (/^package\s+\w+\s*(?:\r?\n|;)/.test(code) && /\bfunc\s+\w+\s*\(/.test(code)) return 'Go'
  if (/^\s*(?:pub\s+)?fn\s+\w+\s*\([^\r\n]*\)\s*(?:->[^\r\n{]+)?\s*\{/m.test(code)) return 'Rust'

  if (/^\s*(?:export\s+)?(?:type\s+\w+\s*=|interface\s+\w+\s*\{\s*(?:readonly\s+)?\w+\??\s*:|(?:const|let|var)\s+\w+\s*:\s*(?:string|number|boolean|unknown|any|never)\b)/m.test(code)) return 'TypeScript'
  if (/^\s*import\b[^;\r\n]*\sfrom\s*(?:['"]|;|$)|^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+\w+\s*\([^\r\n]*\)\s*\{|^\s*(?:export\s+)?const\s+[$\w]+\s*=\s*(?!=)[^\r\n]+;|^\s*console\.(?:log|error|warn)\s*\(/m.test(code)) return 'JavaScript'

  const query = sample.replace(/^(?:--[^\r\n]*(?:\r?\n|$)\s*)+/, '')
  if (/^(?:select\b[^;]+?\bfrom\b|insert\s+into\b[^;]+?\bvalues\s*\(|create\s+table\b[^;]+?\(|update\s+\S+\s+set\s+\w+\s*=|delete\s+from\s+\S+\s+where\b)/i.test(query) &&
      /[=,*;(]/.test(query)) return 'SQL'
  return null
}

export function detectLanguage(text) {
  if (typeof text !== 'string') return null
  const sample = text.slice(0, languageSampleLimit).trim()
  if (!sample) return null
  if (sample.startsWith('#!')) return languageFromShebang(sample)
  const markup = languageFromMarkup(sample)
  if (markup) return markup
  if (looksLikeJson(sample)) return 'JSON'
  // A fenced snippet belongs to the containing Markdown document.
  if (/^ {0,3}(`{3,}|~{3,})[^\r\n]*\r?\n[^]*?^ {0,3}\1[ \t]*$/m.test(sample)) return 'Markdown'
  return languageFromCode(sample)
}
