import ReactCodeMirror, { ChangeSet, EditorState, ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { useState, useRef, useEffect } from 'react'
import { ViewUpdate } from '@codemirror/view'
import { linter, lintGutter } from '@codemirror/lint'
import { Diagnostic as CMDiagnostic } from '@codemirror/lint'
import { Diagnostic as LSPDiagnostic } from 'vscode-languageserver-protocol'

function App(): JSX.Element {
  const [code, setCode] = useState('')
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const [diagnostics, setDiagnostics] = useState<CMDiagnostic[]>([])

  function handleCodeUpdate(update: ViewUpdate): void {
    if (update.docChanged) {
      const changeSet: ChangeSet = update.changes
      const serializedChangeSet = changeSet.toJSON()
      window.api.send('code-delta', serializedChangeSet)
    }
    setCode(update.state.doc.toString())
  }

  function handleFormatCode(): void {
    window.api.invoke<string | undefined>('format-code', code).then((formattedCode) => {
      if (!formattedCode) return
      const changeset = ChangeSet.fromJSON(formattedCode)
      const view = editorRef.current?.view
      if (view) {
        view.dispatch({
          changes: changeset,
          scrollIntoView: true
        })
      }
    })
  }

  useEffect(() => {
    window.api.receive('diagnostics', (receivedDiagnostics: LSPDiagnostic[]) => {
      const view = editorRef.current?.view
      if (!view) return
      const cmDiagnostics = convertLSPDiagnostics(receivedDiagnostics, view.state)
      setDiagnostics(cmDiagnostics)
    })
    return (): void => {
      window.api.removeListeners('diagnostics')
    }
  }, [])

  const linterExtension = linter(() => diagnostics)

  return (
    <>
      <ReactCodeMirror
        ref={editorRef}
        value={code}
        height="300px"
        extensions={[python(), linterExtension, lintGutter()]}
        onUpdate={handleCodeUpdate}
      />
      <button onClick={handleFormatCode}>Format Code</button>
    </>
  )
}

function convertLSPDiagnostics(
  lspDiagnostics: LSPDiagnostic[],
  state: EditorState
): CMDiagnostic[] {
  return lspDiagnostics.map((d) => ({
    from: positionToOffset(d.range.start, state),
    to: positionToOffset(d.range.end, state),
    severity: convertSeverity(d.severity),
    message: d.message,
    source: d.source
  }))
}

function positionToOffset(
  position: { line: number; character: number },
  state: EditorState
): number {
  const line = state.doc.line(position.line + 1)
  return line.from + position.character
}

function convertSeverity(severity: number | undefined): 'info' | 'warning' | 'error' {
  switch (severity) {
    case 1:
      return 'error'
    case 2:
      return 'warning'
    default:
      return 'info'
  }
}

export default App
