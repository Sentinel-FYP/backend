const app = require("express")();
const httpServer = require("http").createServer(app);

const io = require("socket.io")(httpServer, { cors: true });

let rooms = {};

io.on("connection", (socket) => {
  console.log("Connected =>", socket.id);

  let currentDeviceId;

  // Edge will create room of deviceId
  socket.on("create room", (info) => {
    // console.log("Received message:", info);
    console.log("Edge created a room");
    currentDeviceId = info.deviceId;
    if (!rooms[info.deviceId]) {
      // Room does not exist for current device. So create it
      rooms[info.deviceId] = { cams: info.cams, socketId: socket.id };
      currentDeviceId = info.deviceId;
    }

    // console.log("New Rooms", rooms);
  });

  // User will join room of deviceId
  socket.on("join room", (info) => {
    // console.log("Received message:", info);
    console.log("User joined a room");
    if (!rooms[info.deviceId]) {
      // Room does not exist for current device. So device offline
    } else {
      // Joining room
      rooms[info.deviceId].userSocketId = socket.id;
    }

    // console.log("New Rooms", rooms);
  });

  socket.on("disconnect", () => {
    if (rooms[currentDeviceId]) {
      delete rooms[currentDeviceId];
    }

    // console.log("New Rooms", rooms);
    console.log("Disconnect", currentDeviceId);
  });

  socket.on("camRequest", (info) => {
    console.log("Server Received Cam Request:", info);
    io.to(rooms[info.deviceId].socketId).emit("camRequest", { camId: info.camId });
    // socket.broadcast.emit("camRequest", info); // Broadcast the message to all connected clients except self
  });

  socket.on("camData", (data) => {
    console.log("Server Received Cam data:", data);
    console.log(rooms[data.deviceId].userSocketId);
    io.to(rooms[data.deviceId].userSocketId).emit("camData", data);
  });
});

httpServer.listen(5000, () => {
  console.log("Server is running on port 5000");
});
