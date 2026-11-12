export function formatJsonText(text, indent = 2) {
  JSON.parse(text)
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]/g)
  if (!indent) return tokens.join('')
  const parts = []
  let depth = 0
  const newline = () => '\n' + ' '.repeat(indent * depth)
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    if (token === '{' || token === '[') {
      const end = token === '{' ? '}' : ']'
      if (tokens[index + 1] === end) {
        parts.push(token, end)
        index++
      } else {
        depth++
        parts.push(token, newline())
      }
    } else if (token === '}' || token === ']') {
      depth--
      parts.push(newline(), token)
    } else if (token === ',') parts.push(token, newline())
    else if (token === ':') parts.push(': ')
    else parts.push(token)
  }
  if (/\n\s*$/.test(text)) parts.push('\n')
  return parts.join('')
}
