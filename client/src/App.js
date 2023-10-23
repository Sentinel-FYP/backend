import "./App.css";
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

function App() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [myDevice, setMyDevice] = useState("abc");
  const [remoteStream, setRemoteStream] = useState();
  const remoteVideo = useRef();
  const localPeer = useRef();

  useEffect(() => {
    if (remoteStream) {
      remoteVideo.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    const localSocket = io("http://localhost:3300");
    setSocket(localSocket);
    console.log("Connecting");

    localSocket.on("camData", (message) => {
      console.log("Received message:", message);
      setMessages(message.camData);
    });

    localSocket.on("answer", async (message) => {
      setMessages(message);
      console.log("State", localPeer.current.signalingState);
      console.log("Connection state", localPeer.current.connectionState);
      const desc = new RTCSessionDescription({
        sdp: message.sdp,
        type: message.type,
      });
      console.log("Description", desc.toJSON());
      await localPeer.current.setRemoteDescription(desc);
      console.log("State", localPeer.current.signalingState);
    });

    localSocket.on("iceCandidate", async (data) => {
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
            urls: "stun:stun.l.google.com:19302",
          },
          {
            urls: "turn:a.relay.metered.ca:443",
            username: "600d051df7164e74cc88545e",
            credential: "cHXM9rvKAmi8boVQ",
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
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      };

      console.log("State", peer.signalingState);
      const offer = await peer.createOffer(mediaConstraints);
      console.log("Offer", offer);
      console.log("State", peer.signalingState);

      await peer.setLocalDescription(offer);
      console.log("State", peer.signalingState);

      // Gathering all ice candidates
      peer.onicegatheringstatechange = handleIceGathering;

      // peer.onicecandidate = handleIceCandidate;

      peer.onconnectionstatechange = (e) => {
        console.log("Connection state event", e);
        setMessages(e);
      };

      peer.onnegotiationneeded = () => console.log("Negotiation Needed");
      peer.ontrack = (event) => {
        console.log("Adding video track now");
        const newStream = new MediaStream();
        event.streams[0].getTracks().forEach((track) => {
          console.log(track);
          newStream.addTrack(track);
        });
        setRemoteStream(newStream);
      };
      localPeer.current = peer;
    }
  };

  function handleIceGathering(e) {
    const state = e.target.iceGatheringState;
    console.log("Gathering candidate");

    if (state === "complete") {
      localPeer.current.removeEventListener("icegatheringstatechange", () => console.log("Gathering event removed"));
      socket.emit("join room", {
        deviceId: myDevice,
        offer: localPeer.current.localDescription,
      }); // Send a message to the server
    }
  }

  function handleIceCandidate(e) {
    if (e.candidate) {
      console.log("New Candidate");
      // console.log("Candidate", e.candidate);

      let candidateToSend = {
        foundation: e.candidate.foundation,
        component: e.candidate.component,
        ip: e.candidate.address,
        port: e.candidate.port,
        priority: e.candidate.priority,
        protocol: e.candidate.protocol,
        type: e.candidate.type,
        tcpType: e.candidate.tcpType,
        sdpMLineIndex: e.candidate.sdpMLineIndex,
        sdpMid: e.candidate.sdpMid,
        relatedAddress: e.candidate.relatedAddress,
        relatedPort: e.candidate.relatedPort,
      };

      const payload = {
        deviceId: myDevice,
        candidate: candidateToSend,
        user: true,
      };
      // console.log("User ice payload", payload);
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
      <div>{JSON.stringify(messages)}</div>
      <div className="videos">
        <span>
          <h3>Remote Stream</h3>
          <video ref={remoteVideo} id="remoteVideo" autoPlay playsInline></video>
        </span>
      </div>
    </div>
  );
}

export default App;
