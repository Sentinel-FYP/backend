import "./App.css";
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

function App() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [myDevice, setMyDevice] = useState("abc");

  const localPeer = useRef();
  const peer_connection = useRef();

  useEffect(() => {
    const localSocket = io("http://localhost:3300");
    setSocket(localSocket);
    console.log("Connecting");

    localSocket.on("camData", (message) => {
      console.log("Received message:", message);
      setMessages((prev) => [...prev, message.camData]);
    });

    localSocket.on("answer", async (message) => {
      setMessages(message);
      console.log("State", localPeer.current.signalingState);
      console.log("Connection state", localPeer.current.connectionState);
      const desc = new RTCSessionDescription({ sdp: message.sdp, type: message.type });
      console.log("Description", desc.toJSON());
      await localPeer.current.setRemoteDescription(desc);
      console.log("State", localPeer.current.signalingState);
    });

    localSocket.on("ice-candidate", async (data) => {
      console.log("Edge Candidate", data);
      const candidate = new RTCIceCandidate(data.candidate);
      await localPeer.current.addIceCandidate(candidate);
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

  const joinRoom = async () => {
    if (socket) {
      const peer = new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:stun.stunprotocol.org",
          },
        ],
      });

      // peer.onicecandidate = (e) => {
      //   console.log("This");
      //   if (e.candidate) {
      //     console.group("User Ice", e.candidate);
      //     socket.emit("userIceCandidate", { candidate: e.candidate, deviceId: myDevice });
      //   }
      // };

      var mediaConstraints = {
        // offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      };

      console.log("State", peer.signalingState);
      const offer = await peer.createOffer(mediaConstraints);
      console.log("Offer", offer);
      console.log("State", peer.signalingState);

      await peer.setLocalDescription(offer);
      console.log("State", peer.signalingState);

      // peer.addEventListener("message", (m) => setMessages(m));
      peer.onicecandidate = handleIceCandidate;

      localPeer.current = peer;

      socket.emit("join room", { deviceId: myDevice, offer: offer }); // Send a message to the server
    }
  };

  function handleIceCandidate(e) {
    if (e.candidate) {
      console.log("Candidate", e.candidate);

      let candidateToSend = {
        foundation: e.candidate.foundation,
        ip: e.candidate.address,
        port: e.candidate.port,
        priority: e.candidate.priority,
        protocol: e.candidate.protocol,
        type: e.candidate.type,
      };

      const payload = {
        deviceId: myDevice,
        candidate: candidateToSend,
        user: true,
      };
      console.log("User ice payload", payload);
      socket.emit("iceCandidate", payload);
    }
  }

  return (
    <div className="App">
      <input value={myDevice} onChange={(e) => setMyDevice(e.target.value)} />
      <button onClick={() => joinRoom()}>Join Room</button>
      <div>
        <button onClick={() => sendMessage(1)}>Request Camera Stream 1</button>
        <button onClick={() => sendMessage(2)}>Request Camera Stream 2</button>
        <button onClick={() => sendMessage(3)}>Request Camera Stream 3</button>
      </div>
      <div>{messages?.length ? messages.map((message) => <div>{message}</div>) : <div>{JSON.stringify(messages)}</div>}</div>
    </div>
  );
}

export default App;
