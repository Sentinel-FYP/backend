import socketio
import time

# standard Python
sio = socketio.Client()

deviceId = "abcd"
camData = {'1': 'Other device Cam 1', '2': 'Other Device Cam 2', '3': 'Other Device Cam 3'}
cams = ['1', '2', '3']

@sio.event
def connect():
    print("I'm connected!")
    sio.emit('create room', {"deviceId": deviceId, 'cams': cams})

@sio.event
def connect_error():
    print("The connection failed!")

@sio.event
def camRequest(data):
    print('Edge device received cam request!', data)
    cam = data['camId']
    # print("Cam", cam)
    # print("Cam data", camData.get(str(cam), "Unknown Cam"))
    sio.emit("camData", {'camData': camData.get(str(cam), "Unknown Cam"), 'deviceId': deviceId})

@sio.on('price')
def on_message(data):
    print('Price Data ', data)

sio.connect('http://localhost:5000')

# Run indefinitely
while True:
    try:
        time.sleep(1)  # Add a small delay to avoid a busy loop
    except KeyboardInterrupt:
        print("KeyboardInterrupt received. Disconnecting...")
        sio.disconnect()
        break