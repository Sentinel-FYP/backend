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
    const localSocket = io("http://localhost:5001");
    setSocket(localSocket);
    console.log("Connecting");

    localSocket.on("answer", async (message) => {
      setMessages(message);

      const desc = new RTCSessionDescription({
        sdp: message.sdp,
        type: message.type,
      });
      await localPeer.current.setRemoteDescription(desc);
    });

    return () => {
      localSocket.disconnect();
    };
  }, []);

  const joinRoom = async () => {
    if (socket) {
      const configuration = {
        // iceServers: [
        //   { urls: "stun:stun.l.google.com:19302" },
        //   {
        //     url: "turn:13.51.86.179:3478",
        //     username: "admin",
        //     credential: "admin",
        //   },
        //   {
        //     url: "turn:13.51.86.179:3478?transport=udp",
        //     username: "admin",
        //     credential: "admin",
        //   },
        //   {
        //     url: "turn:13.51.86.179:3478?transport=tcp",
        //     username: "admin",
        //     credential: "admin",
        //   },
        // ],
        sdpSemantics: "unified-plan",
        iceServers: [
          {
            urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"],
          },
        ],
      };
      const peer = new RTCPeerConnection(configuration);

      var mediaConstraints = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      };

      // const offer = await peer.createOffer(mediaConstraints);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      // Gathering all ice candidates
      peer.onicegatheringstatechange = handleIceGathering;

      peer.onconnectionstatechange = () =>
        console.log("Connection state is", localPeer.current.connectionState);
      peer.oniceconnectionstatechange = () =>
        console.log("Ice connection state is", localPeer.current.iceConnectionState);
      peer.onsignalingstatechange = () =>
        console.log("Ice connection state is", localPeer.current.signalingState);

      peer.onnegotiationneeded = () => {
        console.log("Negotiation Needed");
        joinRoom();
      };
      peer.ontrack = (event) => {
        console.log("Adding video track now");
        const newStream = new MediaStream();
        event.streams[0].getTracks().forEach((track) => {
          console.log(track);
          newStream.addTrack(track);
        });
        setRemoteStream(newStream);
      };
      peer.addTransceiver("video", { direction: "recvonly" });
      peer.addTransceiver("audio", { direction: "recvonly" });
      localPeer.current = peer;
    }
  };

  function handleIceGathering(e) {
    const state = e.target.iceGatheringState;
    console.log("Ice Gathering State is", state);

    if (state === "complete") {
      localPeer.current.removeEventListener("icegatheringstatechange", () =>
        console.log("Gathering event removed")
      );
      socket.emit("join room", {
        deviceId: myDevice,
        offer: localPeer.current.localDescription,
      }); // Send a message to the server
    }
  }

  return (
    <div className="App">
      <input value={myDevice} onChange={(e) => setMyDevice(e.target.value)} />
      <button onClick={() => joinRoom()}>Join Room</button>
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
