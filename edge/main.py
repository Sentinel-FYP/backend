import socketio
import time
import asyncio
import platform
from aiortc import (
    RTCPeerConnection,
    RTCSessionDescription,
    RTCConfiguration,
    RTCIceServer,
    RTCIceGatherer,
)

from aiortc.contrib.media import MediaPlayer, MediaRelay

relay = None
webcam = None

def create_local_tracks(play_from, decode):
    global relay, webcam

    if play_from:
        player = MediaPlayer(play_from, decode=decode)
        return player.audio, player.video
    else:
        options = {"framerate": "30", "video_size": "640x480"}
        if relay is None:
            if platform.system() == "Darwin":
                # webcam = MediaPlayer(
                #     "default:none", format="avfoundation", options=options
                # )
                webcam = MediaPlayer("./video.mp4")
            elif platform.system() == "Windows":
                # webcam = MediaPlayer(
                #     "video=USB Video Device", format="dshow", options=options
                # )
                # webcam = MediaPlayer(
                #     "video=Integrated Camera", format="dshow", options=options
                # )
                webcam = MediaPlayer("./video.mp4")
            else:
                webcam = MediaPlayer("./video.mp4")
            relay = MediaRelay()
        return None, relay.subscribe(webcam.video)


server_address = "http://192.168.100.7:5001/"
# standard Python
sio = socketio.AsyncClient()
deviceId = "abc"

# ice_servers = [
#     RTCIceServer(urls=["stun:stun.relay.metered.ca:80"]),
#     RTCIceServer(urls=["turn:a.relay.metered.ca:80"], username="600d051df7164e74cc88545e", credential="cHXM9rvKAmi8boVQ"),
#     RTCIceServer(urls=["turn:a.relay.metered.ca:80?transport=tcp"], username="600d051df7164e74cc88545e", credential="cHXM9rvKAmi8boVQ"),
#     RTCIceServer(urls=["turn:a.relay.metered.ca:443"], username="600d051df7164e74cc88545e", credential="cHXM9rvKAmi8boVQ"),
#     RTCIceServer(urls=["turn:a.relay.metered.ca:443?transport=tcp"], username="600d051df7164e74cc88545e", credential="cHXM9rvKAmi8boVQ")
# ]

ice_servers = [
    RTCIceServer(urls=["stun:stun.l.google.com:19302"]),
    RTCIceServer(
        urls=["turn:13.51.86.179:3478"],
        username="admin",
        credential="admin",
    ),
    RTCIceServer(
        urls=["turn:13.51.86.179:3478?transport=udp"],
        username="admin",
        credential="admin",
    ),
    RTCIceServer(
        urls=["turn:13.51.86.179:3478?transport=tcp"],
        username="admin",
        credential="admin",
    ),
]

peer_connection = RTCPeerConnection(
    configuration=RTCConfiguration(iceServers=ice_servers)
)
ice_gatherer = RTCIceGatherer(iceServers=ice_servers)
audio, video = create_local_tracks(None, None)
if audio:
    audio_sender = peer_connection.addTrack(audio)
if video:
    video_sender = peer_connection.addTrack(video)
    print("Got the video and added to track.")

@peer_connection.on("iceconnectionstatechange")
def iceStateChange():
    print("Ice state changed", peer_connection.iceConnectionState)

@peer_connection.on("icegatheringstatechange")
async def iceStateChange():
    print("Ice Gathering state changed", peer_connection.iceGatheringState)

async def setRemoteOffer(offer):
    try:
        # print(offer['offer'])

        print("State 1", peer_connection.signalingState)
        desc = RTCSessionDescription(offer["offer"]["sdp"], offer["offer"]["type"])
        await peer_connection.setRemoteDescription(desc)

        print("State 2", peer_connection.signalingState)

        answer = await peer_connection.createAnswer()
        await peer_connection.setLocalDescription(answer)
        print("State 3", peer_connection.signalingState)
        # print("Local desc", peer_connection.localDescription)
        print("Ice connection state", peer_connection.iceConnectionState)

        return answer
    except Exception as e:
        print("Error in remote offer function", e)


@sio.event
async def connect():
    print("I'm connected!")
    await sio.emit("create room", {"deviceId": deviceId})

@sio.event
async def userJoined(data):
    print("User joined a room user sdp")
    answer = await setRemoteOffer(data)

    message = {"deviceId": deviceId, "sdp": answer.sdp, "type": answer.type}
    await sio.emit("answer", message)

@sio.event
async def connect_error():
    print("The connection failed!")

async def connect_to_server():
    await sio.connect(server_address)

# Run the event loop
async def main():
    await connect_to_server()
    
async def cleanup():
    # Your cleanup code goes here
    print("Disconnecting...")
    await sio.disconnect()
    await peer_connection.close()

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    try:
        loop.create_task(main())
        loop.run_forever()
    except KeyboardInterrupt:
        print("KeyboardInterrupt received.")
        
        # Run cleanup concurrently with the main event loop
        cleanup_task = loop.create_task(cleanup())
        
        # Wait for cleanup to finish before exiting
        loop.run_until_complete(asyncio.gather(cleanup_task))
    finally:
        loop.close()
