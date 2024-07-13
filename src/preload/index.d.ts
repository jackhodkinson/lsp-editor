import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      send: (channel: string, ...args: unknown[]) => void
      receive: (channel: string, func: (...args) => void) => void
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>
      removeListener: (channel: string, func: (...args) => void) => void
      removeListeners: (channel: string) => void
      rawListeners: (channel: string) => unknown[]
    }
  }
}
