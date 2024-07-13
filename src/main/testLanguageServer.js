"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var child_process_1 = require("child_process");
var node_1 = require("vscode-languageserver/node");
console.log('Starting Ruff server...');
var ruffServer = (0, child_process_1.spawn)('ruff', ['server', '--preview', '-v']);
// Create a connection for the server
var connection;
if (ruffServer.stdout && ruffServer.stdin) {
    connection = (0, node_1.createConnection)(new node_1.StreamMessageReader(ruffServer.stdout), new node_1.StreamMessageWriter(ruffServer.stdin));
}
else {
    console.error('Failed to create reader or writer: stdout or stdin is null');
    process.exit(1);
}
console.log('Connection created, setting up handlers...');
connection.onRequest = connection.onRequest.bind(connection);
connection.sendRequest = connection.sendRequest.bind(connection);
connection.onNotification = connection.onNotification.bind(connection);
connection.sendNotification = connection.sendNotification.bind(connection);
// Listen for the initialize request
connection.onInitialize(function (params) {
    console.log('Server initialized with params:', params);
    return {
        capabilities: {
        // Define server capabilities here
        }
    };
});
// Listen for messages from the server
connection.onNotification(function (method, params) {
    console.log('Received notification:', method, params);
});
console.log('Starting to listen on the connection...');
connection.listen();
console.log('Server is now listening for requests.');
// Modify the sendMessage function to use the connection
function sendMessage(message) {
    console.log('Sending message:', JSON.stringify(message, null, 2));
    connection.sendRequest(message.method, message.params).then(function (result) { return console.log('Request result:', result); }, function (error) { return console.error('Request error:', error); });
}
// Send the initialize request
console.log('Sending initialize request...');
var initializeParams = {
    processId: process.pid,
    rootUri: null,
    capabilities: {}
};
var initializeRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: initializeParams
};
sendMessage(initializeRequest);
// Add a delay before keeping the script running
setTimeout(function () {
    console.log('Keeping the script running...');
    process.stdin.resume();
}, 1000);
