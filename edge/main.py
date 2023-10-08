import socketio
import time
import asyncio

from aiortc import (
    RTCIceCandidate,
    RTCPeerConnection,
    RTCSessionDescription,
    RTCConfiguration,
    RTCIceServer,
)

server_address = "http://192.168.1.6:3300"
# standard Python
sio = socketio.Client()

deviceId = "abc"
camData = {"1": "Cam 1", "2": "Cam 2", "3": "Cam 3"}
cams = ["1", "2", "3"]

peer_connection = RTCPeerConnection()
channel = peer_connection.createDataChannel("chat")


async def send_pings(channel):
    num = 0
    while True:
        msg = "From Offerer: {}".format(num)
        print("Sending via RTC Datachannel: ", msg)
        channel.send(msg)
        num += 1
        await asyncio.sleep(1)


@channel.on("open")
def on_open():
    print("channel openned")
    channel.send("Hello from Offerer via Datachannel")
    asyncio.ensure_future(send_pings(channel))


@channel.on("message")
def on_message(message):
    print("Received via RTC Datachannel", message)


# send offer


async def generateLocalOffer():
    await peer_connection.setLocalDescription(await peer_connection.createOffer())


@sio.event
def connect():
    print("I'm connected!")
    sio.emit("create room", {"deviceId": deviceId, "cams": cams})


@sio.event
def roomCreated(data):
    print("Room is created on the server sending offer now", data)
    asyncio.run(generateLocalOffer())
    message = {
        "id": deviceId,
        "sdp": peer_connection.localDescription.sdp,
        "type": peer_connection.localDescription.type,
    }
    sio.emit("offer", {"offer": message})


@sio.event
async def connect_error():
    print("The connection failed!")


@sio.event
def camRequest(data):
    print("Edge device received cam request!", data)
    cam = data["camId"]
    # print("Cam", cam)
    # print("Cam data", camData.get(str(cam), "Unknown Cam"))
    sio.emit(
        "camData",
        {"camData": camData.get(str(cam), "Unknown Cam"), "deviceId": deviceId},
    )


@sio.on("price")
def on_message(data):
    print("Price Data ", data)


sio.connect(server_address)


# Run indefinitely
while True:
    try:
        time.sleep(1)  # Add a small delay to avoid a busy loop
    except KeyboardInterrupt:
        print("KeyboardInterrupt received. Disconnecting...")
        sio.disconnect()
        break
