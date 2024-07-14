import { ChildProcess, spawn } from 'child_process'
import { ChangeSet, Text } from '@codemirror/state'
import { EventEmitter } from 'events'

import {
  Connection,
  createConnection,
  InitializeParams,
  InitializeResult,
  PublishDiagnosticsParams,
  StreamMessageReader,
  StreamMessageWriter,
  TextDocumentContentChangeEvent,
  TextDocumentItem,
  TextEdit,
  Position
} from 'vscode-languageserver/node'

export type LanguageServer = {
  openBlankDocument: () => string
  edit: (documentId: string, changes: ChangeSet) => void
  format: (documentId: string) => Promise<ChangeSet | undefined>
  onDiagnostics: (callback: (diagnostics: PublishDiagnosticsParams) => void) => void
  shutdown: () => Promise<void>
}

export type Document = {
  id: string
  version: number
  code: Text
}

export async function createLanguageServer(): Promise<LanguageServer> {
  const ruffServer = spawn('ruff', ['server', '--preview', '-v'])

  // Debugging the ruff server
  ruffServer.stdout?.on('data', (data) => {
    console.log(`Ruff server stdout: ${data}`)
  })
  ruffServer.stderr?.on('data', (data) => {
    console.error(`Ruff server stderr: ${data}`)
  })

  const connection = createServerConnection(ruffServer)
  const documents = new Map<string, Document>()

  await initializeServer(connection)

  const diagnosticsEmitter = new EventEmitter()

  connection.onNotification(
    'textDocument/publishDiagnostics',
    (params: PublishDiagnosticsParams) => {
      diagnosticsEmitter.emit('diagnostics', params.diagnostics)
    }
  )

  return {
    openBlankDocument: () => openBlankDocument(connection, documents),
    edit: (documentId, changes) => edit(connection, documents, documentId, changes),
    format: (documentId) => format(connection, documents, documentId),
    onDiagnostics: (callback: (diagnostics: PublishDiagnosticsParams) => void): void => {
      diagnosticsEmitter.on('diagnostics', callback)
    },
    shutdown: () => shutdown(connection, ruffServer)
  }
}

export function createServerConnection(ruffServer: ChildProcess): Connection {
  if (ruffServer.stdout && ruffServer.stdin) {
    const connection = createConnection(
      new StreamMessageReader(ruffServer.stdout),
      new StreamMessageWriter(ruffServer.stdin)
    )
    connection.listen()
    return connection
  }
  throw new Error('Failed to create reader or writer: stdout or stdin is null')
}

async function initializeServer(connection: Connection): Promise<void> {
  const initializeParams: InitializeParams = {
    processId: process.pid,
    rootUri: null,
    capabilities: {}
  }
  await connection.sendRequest<InitializeResult>('initialize', initializeParams)
  await connection.sendNotification('initialized')
}

export function openBlankDocument(
  connection: Connection,
  documents: Map<string, Document>
): string {
  const documentId = `file:///document_${Date.now()}.py`
  documents.set(documentId, { id: documentId, version: 0, code: Text.of(['']) })
  connection.sendNotification('textDocument/didOpen', {
    textDocument: TextDocumentItem.create(documentId, 'python', 1, '')
  })
  return documentId
}

export function edit(
  connection: Connection,
  documents: Map<string, Document>,
  documentId: string,
  changes: ChangeSet
): void {
  if (!documents.has(documentId)) {
    console.error(`Document ${documentId} not found. Make sure to open it first.`)
    return
  }

  const document = documents.get(documentId)!
  const currentVersion = document.version
  const newVersion = currentVersion + 1

  // Convert ChangeSet to TextDocumentContentChangeEvent[]
  const contentChanges = convertChangeSetToContentChange(changes, document.code)

  // Apply CodeMirror ChangeSet
  const newCode = changes.apply(document.code)

  documents.set(documentId, { ...document, version: newVersion, code: newCode })

  connection.sendNotification('textDocument/didChange', {
    textDocument: { uri: documentId, version: newVersion },
    contentChanges
  })
}

export function convertChangeSetToContentChange(
  changes: ChangeSet,
  doc: Text
): TextDocumentContentChangeEvent[] {
  const contentChanges: TextDocumentContentChangeEvent[] = []
  changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
    contentChanges.push({
      range: {
        start: positionFromOffset(fromA, doc),
        end: positionFromOffset(toA, doc)
      },
      rangeLength: toA - fromA,
      text: inserted.toString()
    })
  })
  return contentChanges
}

export function positionFromOffset(offset: number, doc: Text): Position {
  const line = doc.lineAt(offset)
  return {
    line: line.number - 1, // CodeMirror uses 1-based line numbers, convert to 0-based
    character: offset - line.from
  }
}

export async function format(
  connection: Connection,
  documents: Map<string, Document>,
  documentId: string
): Promise<ChangeSet | undefined> {
  const document = documents.get(documentId)
  if (!document) {
    throw new Error(`Document ${documentId} not found`)
  }

  const formattingParams = {
    textDocument: { uri: documentId },
    options: { tabSize: 4, insertSpaces: true }
  }

  const formattingResult = await connection.sendRequest<TextEdit[] | null>(
    'textDocument/formatting',
    formattingParams
  )

  if (!formattingResult) {
    return
  }

  const changes = ChangeSet.of(
    formattingResult.map((edit) => ({
      from: positionToOffset(edit.range.start, document.code),
      to: positionToOffset(edit.range.end, document.code),
      insert: edit.newText
    })),
    document.code.length
  )

  // Don't apply state change to backend `documents` yet
  // because the state in the renderer is the source of truth
  return changes
}

function positionToOffset(position: { line: number; character: number }, doc: Text): number {
  const line = doc.line(position.line + 1) // Text lines are 1-indexed
  return line.from + position.character
}

async function shutdown(connection: Connection, ruffServer: ChildProcess): Promise<void> {
  try {
    // Send shutdown request
    await connection.sendRequest('shutdown')

    // Send exit notification
    await connection.sendNotification('exit')

    // Close the connection
    connection.dispose()

    // Kill the ruff server process
    ruffServer.kill()
  } catch (error) {
    console.error('Error during shutdown:', error)
  } finally {
    // Ensure the connection is disposed even if an error occurs
    connection.dispose()
  }
}
