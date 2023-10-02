const app = require("express")();
const httpServer = require("http").createServer(app);

const io = require("socket.io")(httpServer, { cors: true });

io.on("connection", (socket) => {
  const count = io.engine.clientsCount;

  console.log("Connected =>", socket.id, count);

  socket.on("message", (message) => {
    console.log("Received message:", message);
    io.emit("message", message); // Broadcast the message to all connected clients
  });
});

httpServer.listen(5000, () => {
  console.log("Server is running on port 5000");
});
