import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'

import { createWindow } from './createWindow'
import { createLanguageServer, LanguageServer } from './languageServerClient'
import { ChangeSet } from '@uiw/react-codemirror'

let languageServer: LanguageServer

app.whenReady().then(async () => {
  languageServer = await createLanguageServer()
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const documentId = languageServer.openBlankDocument()

  // IPC test
  ipcMain.on('code-delta', (_, serializedChangeSet) => {
    const changeSet = ChangeSet.fromJSON(serializedChangeSet)
    languageServer.edit(documentId, changeSet)
  })
  ipcMain.handle('format-code', async () => {
    const changes = await languageServer.format(documentId)
    return changes?.toJSON()
  })

  const mainWindow = createWindow()
  languageServer.onDiagnostics((diagnostics) => {
    mainWindow.webContents.send('diagnostics', diagnostics)
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Add this new event handler
app.on('before-quit', async (event) => {
  event.preventDefault() // Prevent the app from quitting immediately
  try {
    await languageServer.shutdown()
    console.log('Language server shut down successfully')
  } catch (error) {
    console.error('Error shutting down language server:', error)
  } finally {
    app.exit() // Ensure the app quits even if there's an error
  }
})
