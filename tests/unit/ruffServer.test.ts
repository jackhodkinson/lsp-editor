import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { ChildProcess, spawn } from 'child_process'
import {
  Connection,
  createConnection,
  FormattingOptions,
  InitializeParams,
  InitializeResult,
  StreamMessageReader,
  StreamMessageWriter,
  TextDocumentItem,
  TextEdit
} from 'vscode-languageserver/node'
import { applyEdits } from '../../src/main/applyEdits'

describe('Ruff Language Server', () => {
  let ruffServer: ChildProcess
  let connection: Connection

  beforeAll(() => {
    ruffServer = spawn('ruff', ['server', '--preview', '-v'])

    // ruffServer.stdout?.on('data', (data) => {
    //   console.log(`Ruff server stdout: ${data}`)
    // })

    // ruffServer.stderr?.on('data', (data) => {
    //   console.error(`Ruff server stderr: ${data}`)
    // })

    if (ruffServer.stdout && ruffServer.stdin) {
      connection = createConnection(
        new StreamMessageReader(ruffServer.stdout),
        new StreamMessageWriter(ruffServer.stdin)
      )
    } else {
      throw new Error('Failed to create reader or writer: stdout or stdin is null')
    }

    connection.listen()
  })

  afterAll(() => {
    ruffServer.kill()
  })

  test('Server initializes successfully', async () => {
    const initializeParams: InitializeParams = {
      processId: process.pid,
      rootUri: null,
      capabilities: {}
    }

    const result = await connection.sendRequest<InitializeResult>('initialize', initializeParams)

    expect(result.capabilities).toBeDefined()
    expect(result.capabilities.documentFormattingProvider).toBe(true)

    // Add this line to send the 'initialized' notification
    await connection.sendNotification('initialized')
  })

  test('Server can format a document', async () => {
    const documentUri = 'file:///test.py'
    const documentText = 'def foo():\n    x=1\n    y=2\n    return x+y\n'

    // Open the document
    console.log('Opening document')
    await connection.sendNotification('textDocument/didOpen', {
      textDocument: TextDocumentItem.create(documentUri, 'python', 1, documentText)
    })

    console.log('Requesting formatting')
    // Request formatting
    const formattingOptions: FormattingOptions = {
      tabSize: 4,
      insertSpaces: true
    }

    const formattingParams = {
      textDocument: { uri: documentUri },
      options: formattingOptions
    }

    console.log('Sending formatting request')
    const formattingResult = await connection.sendRequest<TextEdit[]>(
      'textDocument/formatting',
      formattingParams
    )
    console.log('Received formatting result:', formattingResult)

    expect(Array.isArray(formattingResult)).toBe(true)
    expect(formattingResult.length).toBeGreaterThan(0)

    // Apply the formatting changes
    const formattedText = applyEdits(documentText, formattingResult)

    // Check if the formatting improved the code
    expect(formattedText).not.toBe(documentText)
    expect(formattedText).toContain('x = 1')
    expect(formattedText).toContain('y = 2')
    expect(formattedText).toContain('return x + y')
  })

  test('Server can open a document, receive edits, and then format the document correctly', async () => {
    const documentUri = 'file:///test.py'
    const documentText = 'def foo():\n    x=1\n    y=2\n    return x+y\n'

    // Open the document
    await connection.sendNotification('textDocument/didOpen', {
      textDocument: TextDocumentItem.create(documentUri, 'python', 1, documentText)
    })

    // Make an edit to add a third variable
    const editedText = 'def foo():\n    x=1\n    y=2\n    z=3\n    return x+y+z\n'
    await connection.sendNotification('textDocument/didChange', {
      textDocument: { uri: documentUri, version: 2 },
      contentChanges: [{ text: editedText }]
    })

    // Request formatting
    const formattingOptions: FormattingOptions = {
      tabSize: 4,
      insertSpaces: true
    }

    const formattingParams = {
      textDocument: { uri: documentUri },
      options: formattingOptions
    }

    const formattingResult = await connection.sendRequest<TextEdit[]>(
      'textDocument/formatting',
      formattingParams
    )

    expect(Array.isArray(formattingResult)).toBe(true)
    expect(formattingResult.length).toBeGreaterThan(0)

    // Apply the formatting changes
    const formattedText = applyEdits(editedText, formattingResult)

    // Check if the formatting improved the code and the new variable is present
    expect(formattedText).not.toBe(editedText)
    expect(formattedText).toContain('x = 1')
    expect(formattedText).toContain('y = 2')
    expect(formattedText).toContain('z = 3')
    expect(formattedText).toContain('return x + y + z')
  })
})
