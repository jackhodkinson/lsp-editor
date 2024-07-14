import ReactCodeMirror, { ChangeSet, ReactCodeMirrorRef } from '@uiw/react-codemirror'
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
    window.api.invoke<string>('format-code', code).then((formattedCode) => {
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
      const cmDiagnostics = convertLSPDiagnostics(receivedDiagnostics)
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
        height="200px"
        extensions={[python(), linterExtension, lintGutter()]}
        onUpdate={handleCodeUpdate}
      />
      <button onClick={handleFormatCode}>Format Code</button>
    </>
  )
}

function convertLSPDiagnostics(lspDiagnostic: LSPDiagnostic[]): CMDiagnostic[] {
  return lspDiagnostic.map((d) => ({
    from: d.range.start.character,
    to: d.range.end.character,
    severity: convertSeverity(d.severity),
    message: d.message,
    source: d.source
  }))
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
