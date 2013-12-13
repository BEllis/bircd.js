var net = require('net');
var commands = require('./commands.js');

    var BIRCSession = function(socket) {
        var self = this;
        self.bufferSize = 512;
        self.buffer = new Buffer(this.bufferSize);
        self.size = 0;
        
        var getLastByteOnBuffer = function() {
            if (this.size === 0) {
                return null;
            }
            
           var lastByteIndex = (this.position + this.size) % this.bufferSize;
           return this.buffer[lastByteIndex];
        };
        
        var appendChunkToBuffer = function(chunk) {
            if (chunk.length + self.size > self.bufferSize) {
                throw 'buffer overflow';
            }
            
            chunk.copy(self.buffer, self.size);
            self.size += chunk.length;
        }
        
        var readToSpace = function(buffer, position) {
            var index = position;
            while (index < buffer.length && buffer[index] != 0x20) {
                index++;
            }
            var endOfData = index;
            
            while (index < buffer.length && buffer[index] == 0x20) {
                index++;
            }
            
            return { buffer: buffer.slice(position, endOfData), index: index };
        }
        
        var parseCommand = function(buffer)
        {
            var param;
            var readResult;
            var prefix = null;
            var command = null;
            var params = [];
            var index = 0;
            if (buffer[index] === 0x3A)
            {
                readResult = readToSpace(buffer, ++index);
                prefix = readResult.buffer.toString('utf8');
                index = readResult.index;
            }
            
            readResult = readToSpace(buffer, index);
            command = readResult.buffer.toString('ascii');
            index = readResult.index;
            
            while (index !== buffer.length)
            {
                if (buffer[index] === 0x3A) {
                    index++;
                    param = buffer.slice(index, buffer.length);
                    index = buffer.length;
                }
                else {
                    readResult = readToSpace(buffer, index);
                    param = readResult.buffer;
                    index = readResult.index;
                }
                
                params.push(param)
            }
            
            return { prefix: prefix, command: command, params: params };
        }
        
        var clearBuffer = function() {
            self.size = 0;
        };
        
        // Preamble
        var clientId = socket.remoteAddress + ':' + socket.remotePort;
          console.log(clientId + ' connected.');
          socket.setTimeout(30000, function() {
             console.log(clientId + ' timed out.');
          });
          socket.setKeepAlive(true, 0);
          socket.on('end', function() {
            console.log(clientId + ' disconnected.');
          });
          socket.on('data', function(chunk) {
              // Check for CR LF
              var startOfChunk = 0;
              for (var i = 0; i < chunk.length; i++)
              {
                  if (chunk[i] === 0x0A) {
                    if (i === 0) {
                        // Check last byte on buffer
                        if (getLastByteOnBuffer() == 0x0D)
                        {
                            // Concatenate with buffer and process command
                            appendChunkToBuffer(chunk.slice(0, i));
                            var command = parseCommand(self.buffer.slice(0, self.size - 2 + 1));
                            console.log(command);
                            clearBuffer();
                            startOfChunk = i + 1
                        }
                        else
                        {
                            // Concatenate with buffer and process command
                            appendChunkToBuffer(chunk.slice(0, i));
                            var command = parseCommand(self.buffer.slice(0, self.size - 1 + 1));
                            console.log(command);
                            clearBuffer();
                            startOfChunk = i + 1
                        }
                    }
                    else
                    {
                        if (chunk[i-1] === 0x0D)
                        {
                            // Concatenate with buffer and process command
                            appendChunkToBuffer(chunk.slice(0, i));
                            var command = parseCommand(self.buffer.slice(0, self.size - 2 + 1));
                            console.log(command);
                            clearBuffer();
                            startOfChunk = i + 1;
                        }
                        else
                        {
                            // Concatenate with buffer and process command
                            appendChunkToBuffer(chunk.slice(0, i));
                            var command = parseCommand(self.buffer.slice(0, self.size - 1 + 1));
                            console.log(command);
                            clearBuffer();
                            startOfChunk = i + 1
                        }
                    }
                  }
              }
              
              if (startOfChunk < chunk.length) {
                appendChunkToBuffer(chunk.slice(startOfChunk, chunk.length - startOfChunk));
              }
          });
    };

    var BIRCDServer = function(options, connectionListener) {
        var self = this;
        self.sessions = [];
        var connectionListenerWrapper = function(c) {
            
            var session = new BIRCSession(c);
            self.sessions.push(session);

            // New connection
            if (connectionListener && 'function' == typeof(connectionListener))
            {
                connectionListener(session);
            }
        };
        
        var server = net.createServer(options, connectionListenerWrapper);
        server.on('error', function (e) {
          if (e.code == 'EADDRINUSE') {
            console.log('Address in use, retrying...');
            setTimeout(function () {
              server.close();
              server.listen(this.port, this.address);
            }, 1000);
          }
        });
        
        this.server = server;
    };
    
    BIRCDServer.prototype.listen = function (port, address) {
        var self = this;
        self.port = port;
        self.address = address;
        self.server.listen(port, address, function() {
            self.port = this.address().port;
            self.address = this.address().address;
            console.log('bIRCd instance successfully bound to ' + self.address + ':' + self.port)
        })
    }

exports.createServer = function(options, connectionListener)
{
    return new BIRCDServer(options, connectionListener);
}