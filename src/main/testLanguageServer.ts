import { ChildProcess, spawn } from 'child_process'
import {
  createConnection,
  InitializeParams,
  StreamMessageReader,
  StreamMessageWriter,
  RequestMessage
} from 'vscode-languageserver/node'

console.log('Starting Ruff server...')
const ruffServer: ChildProcess = spawn('ruff', ['server', '--preview', '-v'])

// Create a connection for the server
let connection
if (ruffServer.stdout && ruffServer.stdin) {
  connection = createConnection(
    new StreamMessageReader(ruffServer.stdout),
    new StreamMessageWriter(ruffServer.stdin)
  )
} else {
  console.error('Failed to create reader or writer: stdout or stdin is null')
  process.exit(1)
}

console.log('Connection created, setting up handlers...')

connection.onRequest = connection.onRequest.bind(connection)
connection.sendRequest = connection.sendRequest.bind(connection)
connection.onNotification = connection.onNotification.bind(connection)
connection.sendNotification = connection.sendNotification.bind(connection)

// Listen for the initialize request
connection.onInitialize((params: InitializeParams) => {
  console.log('Server initialized with params:', params)
  return {
    capabilities: {
      // Define server capabilities here
    }
  }
})

// Listen for messages from the server
connection.onNotification((method, params) => {
  console.log('Received notification:', method, params)
})

console.log('Starting to listen on the connection...')
connection.listen()

console.log('Server is now listening for requests.')

// Modify the sendMessage function to use the connection
function sendMessage(message: RequestMessage): void {
  console.log('Sending message:', JSON.stringify(message, null, 2))
  connection.sendRequest(message.method, message.params).then(
    (result) => console.log('Request result:', result),
    (error) => console.error('Request error:', error)
  )
}

// Send the initialize request
console.log('Sending initialize request...')
const initializeParams: InitializeParams = {
  processId: process.pid,
  rootUri: null,
  capabilities: {}
}
const initializeRequest: RequestMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: initializeParams
}

sendMessage(initializeRequest)

// Add a delay before keeping the script running
setTimeout(() => {
  console.log('Keeping the script running...')
  process.stdin.resume()
}, 1000)
