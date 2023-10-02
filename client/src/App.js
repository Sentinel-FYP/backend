import "./App.css";
import { useState, useEffect } from "react";
import { io } from "socket.io-client";

function App() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const localSocket = io("http://localhost:5000");
    setSocket(localSocket);
    console.log("Connecting");

    localSocket.on("message", (message) => {
      console.log("Received message:", message);
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      localSocket.disconnect();
    };
  }, []);

  const sendMessage = () => {
    if (socket) {
      socket.emit("message", "Hello from client!"); // Send a message to the server
    }
  };

  return (
    <div className="App">
      <button onClick={sendMessage}>Send Message</button>
      <div>
        {messages.map((message) => (
          <div>{message}</div>
        ))}
      </div>
    </div>
  );
}

export default App;
