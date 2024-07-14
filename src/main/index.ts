import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'

import { createWindow } from './createWindow'
import { createLanguageServer, LanguageServer } from './languageServerClient'
import { ChangeSet } from '@uiw/react-codemirror'

app.whenReady().then(async () => {
  const languageServer: LanguageServer = await createLanguageServer()
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
    return await languageServer.format(documentId)
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
