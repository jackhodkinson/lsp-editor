import ReactCodeMirror, { ChangeSet, ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { useState, useRef } from 'react'
import { ViewUpdate } from '@codemirror/view'

function App(): JSX.Element {
  const [code, setCode] = useState('')
  const editorRef = useRef<ReactCodeMirrorRef>(null)

  function handleCodeUpdate(update: ViewUpdate): void {
    if (update.docChanged) {
      const preJsonChanges: ChangeSet = update.changes
      const changes = preJsonChanges.toJSON()
      window.api.send('code-delta', changes)
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

  return (
    <>
      <ReactCodeMirror
        ref={editorRef}
        value={code}
        height="200px"
        extensions={[python()]}
        onUpdate={handleCodeUpdate}
      />
      <button onClick={handleFormatCode}>Format Code</button>
    </>
  )
}

export default App
