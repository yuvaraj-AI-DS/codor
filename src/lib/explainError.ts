import type { Diagnosis, ParsedError } from '../types/runtime'

/**
 * Deterministic diagnosis from the error type + message Python actually raised.
 * Nothing here is generated: every sentence is filled from the real traceback.
 * Replace or augment with an AI call later — BobPanel only needs a Diagnosis.
 */
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const an = (w: string) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`)

export function explainError(err: ParsedError, openFiles: string[]): Diagnosis {
  const msg = err.message
  let m: RegExpExecArray | null

  switch (err.type) {
    case 'NameError': {
      m = /name '(\w+)' is not defined(?:.*Did you mean: '(\w+)'\?)?/.exec(msg)
      if (m) {
        return {
          summary: `\`${m[1]}\` is used before it is assigned, defined, or imported.`,
          hint: m[2] ? `Python suggests \`${m[2]}\` — likely a typo.` : 'Check the spelling, or assign it above this line.',
          snippet: m[2] ?? null,
        }
      }
      break
    }
    case 'TypeError': {
      if ((m = /unsupported operand type\(s\) for (.+?): '(\w+)' and '(\w+)'/.exec(msg))) {
        const [, op, a, b] = m
        const toStr = a === 'str' || b === 'str'
        return {
          summary: `\`${op}\` can't combine ${an(a)} with ${an(b)}.`,
          hint: toStr ? 'Convert one side so both are the same type.' : `Make both operands the same type before using \`${op}\`.`,
          snippet: toStr ? (a === 'str' ? 'int(value)  # or str(other)' : 'str(value)  # or int(other)') : null,
        }
      }
      if ((m = /can only concatenate str \(not "(\w+)"\) to str/.exec(msg))) {
        return {
          summary: `${cap(an(m[1]))} is being joined to a string with \`+\`.`,
          hint: 'Wrap the value in str(), or use an f-string.',
          snippet: 'f"text {value}"',
        }
      }
      if ((m = /'(\w+)' object is not callable/.exec(msg))) {
        return {
          summary: `${cap(an(m[1]))} value is being called like a function.`,
          hint: 'A variable may be shadowing a function name, or there are extra parentheses.',
          snippet: null,
        }
      }
      if ((m = /(\w+)\(\) missing (\d+) required positional arguments?: (.+)/.exec(msg))) {
        return {
          summary: `\`${m[1]}()\` was called without ${m[3]}.`,
          hint: `Pass ${m[2]} more argument${m[2] === '1' ? '' : 's'} at the call site.`,
          snippet: null,
        }
      }
      if ((m = /(\w+)\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given/.exec(msg))) {
        return {
          summary: `\`${m[1]}()\` accepts ${m[2]} argument(s) but received ${m[3]}.`,
          hint: 'Match the call to the function signature (methods also receive self).',
          snippet: null,
        }
      }
      break
    }
    case 'SyntaxError':
    case 'IndentationError':
    case 'TabError':
      return {
        summary: msg ? `Python couldn't parse this line: ${msg}.` : "Python couldn't parse this line.",
        hint: err.type === 'SyntaxError'
          ? 'Check brackets, quotes, and colons around the marked line.'
          : 'Make indentation consistent — 4 spaces per level.',
        snippet: null,
      }
    case 'ZeroDivisionError':
      return { summary: 'A value is divided by zero.', hint: 'Guard the divisor before dividing.', snippet: 'if d != 0:\n    result = n / d' }
    case 'IndexError':
      return { summary: `A list or string is indexed past its end (${msg}).`, hint: 'Check the index against len() first.', snippet: null }
    case 'KeyError':
      return { summary: `Key ${msg} is not in the dictionary.`, hint: 'Use .get() or check `in` before reading.', snippet: `d.get(${msg || 'key'})` }
    case 'AttributeError':
      if ((m = /'(\w+)' object has no attribute '(\w+)'/.exec(msg))) {
        return { summary: `${cap(an(m[1]))} has no \`${m[2]}\`.`, hint: `Check the spelling, or confirm the value really is the type you expect.`, snippet: null }
      }
      break
    case 'ValueError':
      if ((m = /invalid literal for int\(\) with base \d+: (.+)/.exec(msg))) {
        return { summary: `int() received ${m[1]}, which isn't a whole number.`, hint: 'Validate or strip the input before converting.', snippet: null }
      }
      break
    case 'ModuleNotFoundError':
      if ((m = /No module named '([\w.]+)'/.exec(msg))) {
        const mod = m[1].split('.')[0]
        const tab = `${mod}.py`
        return {
          summary: `There is no module called \`${mod}\` here.`,
          hint: openFiles.includes(tab)
            ? `${tab} is open — check the import path.`
            : `Create a ${tab} tab to import it, or note that this package may not ship with Pyodide.`,
          snippet: null,
        }
      }
      break
    case 'ImportError':
      return { summary: msg, hint: 'Check that the name exists in the file you import from.', snippet: null }
    case 'RecursionError':
      return { summary: 'A function keeps calling itself without stopping.', hint: 'Add or fix the base case.', snippet: null }
  }

  return { summary: msg || `${err.type} was raised.`, hint: null, snippet: null }
}
