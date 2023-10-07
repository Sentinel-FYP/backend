import "./App.css";
import { useState, useEffect } from "react";
import { io } from "socket.io-client";

function App() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [myDevice, setMyDevice] = useState("abc");

  useEffect(() => {
    const localSocket = io("http://localhost:5000");
    setSocket(localSocket);
    console.log("Connecting");

    localSocket.on("camData", (message) => {
      console.log("Received message:", message);
      setMessages((prev) => [...prev, message.camData]);
    });

    return () => {
      localSocket.disconnect();
    };
  }, []);

  const sendMessage = (camId) => {
    if (socket) {
      socket.emit("camRequest", { deviceId: myDevice, camId }); // Send a message to the server
    }
  };

  const joinRoom = () => {
    if (socket) {
      socket.emit("join room", { deviceId: myDevice }); // Send a message to the server
    }
  };

  return (
    <div className="App">
      <input value={myDevice} onChange={(e) => setMyDevice(e.target.value)} />
      <button onClick={() => joinRoom()}>Join Room</button>
      <div>
        <button onClick={() => sendMessage(1)}>Request Camera Stream 1</button>
        <button onClick={() => sendMessage(2)}>Request Camera Stream 2</button>
        <button onClick={() => sendMessage(3)}>Request Camera Stream 3</button>
      </div>
      <div>
        {messages.map((message) => (
          <div>{message}</div>
        ))}
      </div>
    </div>
  );
}

export default App;
