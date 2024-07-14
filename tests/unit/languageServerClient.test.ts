import { PublishDiagnosticsParams } from 'vscode-languageserver-protocol'
import { createLanguageServer, LanguageServer } from '../../src/main/languageServerClient'
import { ChangeSet } from '@codemirror/state'

jest.unmock('child_process')

describe('languageServerClient', () => {
  let server: LanguageServer

  beforeAll(async () => {
    server = await createLanguageServer()
  })

  afterAll(async () => {
    await server.shutdown()
  })

  describe('openBlankDocument', () => {
    it('should create a new document with a unique ID', () => {
      const documentId = server.openBlankDocument()

      expect(documentId).toMatch(/^file:\/\/\/document_\d+\.py$/)
    })
  })

  describe('edit', () => {
    it('should update the document', () => {
      const documentId = server.openBlankDocument()
      const changes = ChangeSet.of([{ from: 0, to: 0, insert: 'print("Hello, World!")' }], 0)

      server.edit(documentId, changes)

      // We can't directly check the document content here, but we can test that the edit doesn't throw an error
    })

    it('should handle multiple changes', () => {
      const documentId = server.openBlankDocument()
      const changes = ChangeSet.of(
        [
          { from: 0, to: 0, insert: 'print("Hello")' },
          { from: 0, to: 0, insert: '\nprint("World")' }
        ],
        0
      )

      server.edit(documentId, changes)

      // Again, we're testing that the edit doesn't throw an error
    })
  })

  describe('format', () => {
    it('should request formatting and return changes', async () => {
      const documentId = server.openBlankDocument()
      server.edit(
        documentId,
        ChangeSet.of([{ from: 0, to: 0, insert: 'def foo():\n  return 1' }], 0)
      )

      const result: ChangeSet | undefined = await server.format(documentId)

      expect(result?.toJSON()).toEqual(
        expect.arrayContaining([
          expect.any(Number),
          expect.arrayContaining([expect.any(Number), expect.any(String), expect.any(String)])
        ])
      )
    })
  })

  describe('onDiagnostics', () => {
    it('should handle diagnostics notifications', (done) => {
      const documentId = server.openBlankDocument()
      server.edit(documentId, ChangeSet.of([{ from: 0, to: 0, insert: 'x = 1\nprint(y)' }], 0))

      const timeout = setTimeout(() => {
        done(new Error('Timeout waiting for diagnostics'))
      }, 5000) // 5 second timeout

      server.onDiagnostics((params: PublishDiagnosticsParams) => {
        clearTimeout(timeout)
        console.log('DIAGNOSTIC PARAMS ARE', params)
        expect(params).toBeDefined()
        expect(params).toEqual([
          expect.objectContaining({
            code: 'F821',
            message: 'Undefined name `y`',
            severity: 1,
            source: 'Ruff',
            range: expect.any(Object),
            data: expect.objectContaining({
              code: 'F821',
              edits: expect.any(Array),
              kind: expect.any(Object),
              noqa_edit: expect.any(Object)
            }),
            codeDescription: {
              href: 'https://docs.astral.sh/ruff/rules/undefined-name'
            }
          })
        ])
        done()
      })
    })
  })
})
