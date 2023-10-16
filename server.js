const app = require("express")();
const httpServer = require("http").createServer(app);
const os = require("os");

// Get the network interfaces
const networkInterfaces = os.networkInterfaces();

const io = require("socket.io")(httpServer, { cors: true });
const port = 3300;
let rooms = {};

io.on("connection", (socket) => {
  console.log("Connected =>", socket.id);

  let currentDeviceId;

  // Edge will create room of deviceId
  socket.on("create room", (info) => {
    // console.log("Received message:", info);
    console.log("Edge created a room");
    currentDeviceId = info.deviceId;
    console.log("Edge device id ", currentDeviceId);
    if (!rooms[info.deviceId]) {
      // Room does not exist for current device. So create it
      rooms[info.deviceId] = { cams: info.cams, deviceSocketId: socket.id };
      currentDeviceId = info.deviceId;
    }

    // console.log("emiting room created event now");
    // io.to(rooms[info.deviceId].deviceSocketId).emit("roomCreated", {
    //   roomId: info.deviceId,
    // });

    // console.log("New Rooms", rooms);
  });

  // User will join room of deviceId
  socket.on("join room", (info) => {
    if (!rooms[info.deviceId]) {
      // Room does not exist for current device. So device offline
    } else {
      console.log("Received message:", info);
      console.log("User joined a room");
      // Joining room
      rooms[info.deviceId].userSocketId = socket.id;
      io.to(rooms[info.deviceId].deviceSocketId).emit("userJoined", info);
    }

    // console.log("New Rooms", rooms);
  });

  socket.on("answer", (data) => {
    console.log("Server Received answer:", data);
    console.log(rooms[data.deviceId].userSocketId);
    io.to(rooms[data.deviceId].userSocketId).emit("answer", data);
  });

  socket.on("iceCandidate", (data) => {
    console.log("Server Received candidate:", data);
    if (data.user) {
      io.to(rooms[data.deviceId].deviceSocketId).emit("iceCandidate", data);
    } else {
      io.to(rooms[data.deviceId].user).emit("iceCandidate", data);
    }
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
    io.to(rooms[info.deviceId].deviceSocketId).emit("camRequest", {
      camId: info.camId,
    });
    // socket.broadcast.emit("camRequest", info); // Broadcast the message to all connected clients except self
  });

  socket.on("camData", (data) => {
    console.log("Server Received Cam data:", data);
    console.log(rooms[data.deviceId].userSocketId);
    io.to(rooms[data.deviceId].userSocketId).emit("camData", data);
  });

  socket.on("offer", (data) => {
    console.log("Recieved an offer from the edge device");
    console.log(JSON.stringify(data.offer, null, 2));
  });
});

httpServer.listen(port, () => {
  // Loop through the network interfaces to find the IP address
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    const interfaceData = networkInterfaces[interfaceName];
    for (const network of interfaceData) {
      if (network.family === "IPv4" && !network.internal) {
        console.log(`Server IP address: http://${network.address}:${port}`);
      }
    }
  });
});
