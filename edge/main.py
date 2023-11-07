import socketio
import time
import asyncio
import platform
from aiortc import (
    RTCIceCandidate,
    RTCPeerConnection,
    RTCSessionDescription,
    RTCConfiguration,
    RTCIceServer,
    RTCIceGatherer
)

from aiortc.contrib.media import MediaPlayer, MediaRelay
from aiortc.rtcrtpsender import RTCRtpSender

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
                webcam = MediaPlayer(
                    "default:none", format="avfoundation", options=options
                )
            elif platform.system() == "Windows":
                # webcam = MediaPlayer(
                #     "video=USB Video Device", format="dshow", options=options
                # )
                # webcam = MediaPlayer(
                #     "video=Integrated Camera", format="dshow", options=options
                # )
                webcam = MediaPlayer("./video.mp4")
            else:
                webcam = MediaPlayer("/dev/video0", format="v4l2", options=options)
            relay = MediaRelay()
        return None, relay.subscribe(webcam.video)

server_address = "http://localhost:3300"
# standard Python
sio = socketio.AsyncClient()

deviceId = "abc"
camData = {"1": "Cam 1", "2": "Cam 2", "3": "Cam 3"}
cams = ["1", "2", "3"]

# ice_servers = [
#     RTCIceServer(urls=["stun:stun.relay.metered.ca:80"]), 
#     RTCIceServer(urls=["turn:a.relay.metered.ca:80"], username="600d051df7164e74cc88545e", credential="cHXM9rvKAmi8boVQ"),
#     RTCIceServer(urls=["turn:a.relay.metered.ca:80?transport=tcp"], username="600d051df7164e74cc88545e", credential="cHXM9rvKAmi8boVQ"),
#     RTCIceServer(urls=["turn:a.relay.metered.ca:443"], username="600d051df7164e74cc88545e", credential="cHXM9rvKAmi8boVQ"),
#     RTCIceServer(urls=["turn:a.relay.metered.ca:443?transport=tcp"], username="600d051df7164e74cc88545e", credential="cHXM9rvKAmi8boVQ")
# ]

# ice_servers = [
#     RTCIceServer(urls=["stun:stun.l.google.com:19302"]), 
#     RTCIceServer(urls=["turn:a.relay.metered.ca:80"], username="600d051df7164e74cc88545e", credential="cHXM9rvKAmi8boVQ"),
#     RTCIceServer(urls=["turn:a.relay.metered.ca:80?transport=tcp"], username="600d051df7164e74cc88545e", credential="cHXM9rvKAmi8boVQ"),
#     RTCIceServer(urls=["turn:a.relay.metered.ca:443"], username="600d051df7164e74cc88545e", credential="cHXM9rvKAmi8boVQ"),
#     RTCIceServer(urls=["turn:a.relay.metered.ca:443?transport=tcp"], username="600d051df7164e74cc88545e", credential="cHXM9rvKAmi8boVQ")
# ]

# peer_connection = RTCPeerConnection(configuration=RTCConfiguration(iceServers=ice_servers))
# ice_gatherer = RTCIceGatherer(iceServers=ice_servers)

peer_connection = RTCPeerConnection()
ice_gatherer = RTCIceGatherer()

audio, video = create_local_tracks(None,None)
if audio:
        audio_sender = peer_connection.addTrack(audio)
if video:
    video_sender = peer_connection.addTrack(video)
    print("Got the video and added to track.")

# channel = peer_connection.createDataChannel("stream")

# async def send_pings(channel):
#     num = 0
#     while True:
#         msg = "From Offerer: {}".format(num)
#         print("Sending via RTC Datachannel: ", msg)
#         channel.send(msg)
#         num += 1
#         await asyncio.sleep(1)

async def getLocalCadidates():
    await ice_gatherer.gather()
    local_cadidates = ice_gatherer.getLocalCandidates()
    return local_cadidates

@peer_connection.on("icecandidate")
def handleCandidate(e):
    print("Device Ice", e)
    if (e.candidate):
        sio.emit("iceCandidate", {'deviceId': deviceId,'candidate': e['candidate']})

@peer_connection.on('iceconnectionstatechange')
def iceStateChange():
    print("Ice state changed", peer_connection.iceConnectionState)

@peer_connection.on('icegatheringstatechange')
async def iceStateChange():
    print("Ice Gathering state changed", peer_connection.iceGatheringState)
    local_cadidates = ice_gatherer.getLocalCandidates()
    # print("Local candidate", local_cadidates)

    if(peer_connection.iceGatheringState == 'complete'):
        print("Local candidate gathered")
        for i in local_cadidates:

            candidateToSend = {
                'foundation': i.foundation,
                'component': i.component,
                'ip': i.ip,
                'port': i.port,
                'priority': i.priority,
                'protocol': i.protocol,
                'type': i.type,
                'tcpType': i.tcpType,
                'sdpMLineIndex': i.sdpMLineIndex,
                'sdpMid': i.sdpMid,
                'relatedAddress': i.relatedAddress,
                'relatedPort': i.relatedPort,
            }

            await sio.emit("iceCandidate", {'deviceId': deviceId,'candidate': candidateToSend})




async def generateLocalOffer():
    await peer_connection.setLocalDescription(await peer_connection.createOffer())
    print("Conn", peer_connection.signalingState)

async def startGathering():
    await ice_gatherer.gather()

async def handleAddIceCandidate(candidate):
    try:
        # print("Candidate",candidate)
        await peer_connection.addIceCandidate(candidate)
    except Exception as e:
        print("Error in adding candidate", e)

async def setRemoteOffer(offer):
    try:
        # print(offer['offer'])

        print("State 1", peer_connection.signalingState)
        desc = RTCSessionDescription(offer['offer']['sdp'], offer['offer']['type'])
        await peer_connection.setRemoteDescription(desc)

        print("State 2", peer_connection.signalingState)

        answer = await peer_connection.createAnswer()
        await peer_connection.setLocalDescription(answer)
        print("State 3", peer_connection.signalingState)
        print("Local desc", peer_connection.localDescription)
        print("Ice connection state", peer_connection.iceConnectionState)

        return answer
    except Exception as e:
        print("Error in remote offer function", e)

@sio.event
async def connect():
    print("I'm connected!")
    await sio.emit("create room", {"deviceId": deviceId, "cams": cams})


@sio.event
async def roomCreated(data):
    print("Room is created on the server sending offer now", data)
    # asyncio.run(generateLocalOffer())
    # message = {
    #     "id": deviceId,
    #     "sdp": peer_connection.localDescription.sdp,
    #     "type": peer_connection.localDescription.type,
    # }
    # sio.emit("offer", {"offer": message})

@sio.event
async def userJoined(data):
    print("User joined a room user sdp")
    
    # await startGathering()
    

    # print("User joined a room user sdp:", data)
    answer = await setRemoteOffer(data)
    # print("Answer to send back", answer)
    # asyncio.run(generateLocalOffer())
    
    message = {
        "deviceId": deviceId,
        "sdp": answer.sdp, 
        'type': answer.type
    }
    await sio.emit('answer', message)

@sio.event
async def iceCandidate(data):
    print("Received Ice candidate")
    # print("User Candidate", data)

    candidate = RTCIceCandidate(
        data['candidate']['component'],
        data['candidate']['foundation'],
        data['candidate']['ip'], 
        data['candidate']['port'], 
        data['candidate']['priority'], 
        data['candidate']['protocol'], 
        data['candidate']['type'],
        data['candidate']['relatedAddress'],
        data['candidate']['relatedPort'],
        data['candidate']['sdpMid'],
        data['candidate']['sdpMLineIndex'],
        data['candidate']['tcpType'],
    )
    
    await handleAddIceCandidate(candidate)

@sio.event
async def connect_error():
    print("The connection failed!")


@sio.event
async def camRequest(data):
    print("Edge device received cam request!", data)
    cam = data["camId"]

    can = asyncio.run(getLocalCadidates())
    
    print("Local candidates", can)
    # print("Cam", cam)
    # print("Cam data", camData.get(str(cam), "Unknown Cam"))
    sio.emit(
        "camData",
        {"camData": camData.get(str(cam), "Unknown Cam"), "deviceId": deviceId},
    )


@sio.on("price")
async def on_message(data):
    print("Price Data ", data)

# Connect to the server
async def connect_to_server():
    await sio.connect(server_address)

# Run the event loop
async def main():
    await connect_to_server()

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(main())
        loop.run_forever()
    except KeyboardInterrupt:
        print("KeyboardInterrupt received. Disconnecting...")
        relay.unsubscribe()
        loop.run_until_complete(sio.disconnect())
        loop.close()