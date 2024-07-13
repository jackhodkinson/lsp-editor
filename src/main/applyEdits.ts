import { TextEdit } from 'vscode-languageserver/node'

export function applyEdits(text: string, edits: TextEdit[]): string {
  // Sort the edits in reverse order
  edits.sort(
    (a, b) =>
      b.range.start.line - a.range.start.line || b.range.start.character - a.range.start.character
  )

  let result = text
  for (const edit of edits) {
    const start = getOffsetForPosition(result, edit.range.start)
    const end = getOffsetForPosition(result, edit.range.end)
    result = result.slice(0, start) + edit.newText + result.slice(end)
  }
  return result
}

function getOffsetForPosition(text: string, position: { line: number; character: number }): number {
  const lines = text.split('\n')
  let offset = 0
  for (let i = 0; i < position.line; i++) {
    offset += lines[i].length + 1 // +1 for the newline character
  }
  return offset + position.character
}
