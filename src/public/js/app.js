const socket = io();

const myFace = document.getElementById("myFace");
const peersFace = document.getElementById("peersFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");

const call = document.getElementById("call");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let userName;
let roomName;
let myPeerConnection;
let myDataChannel;

const getCameras = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks()[0];
    camerasSelect.innerHTML = "";
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
};

const getMedia = async (deviceId) => {
  const initialConstraints = {
    audio: true,
    video: { facingMode: "user" },
  };
  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstraints
    );
    // Starts as muted
    myStream.getAudioTracks().forEach((track) => (track.enabled = false));
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras(deviceId);
    }
  } catch (e) {
    console.log(e);
  }
};

const handleMuteClick = () => {
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    muteBtn.innerText = "Mute";
    muted = true;
  } else {
    muteBtn.innerText = "Unmute";
    muted = false;
  }
};

const handleCameraClick = () => {
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraBtn.innerText = "Turn Camera Off";
    cameraOff = false;
  } else {
    cameraBtn.innerText = "Turn Camera On";
    cameraOff = true;
  }
};

const handleCameraChange = async () => {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
};

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Lobby / Rooms

const welcome = document.getElementById("welcome");
const usernameForm = document.getElementById("username");
const welcomeForm = welcome.querySelector("#roomname");

const initCall = async (roomName) => {
  const h2 = document.getElementById("myusername");
  h2.innerText = `You (${userName})`;
  const roomWelcomeMsg = document.getElementById("roomwelcome");
  roomWelcomeMsg.innerText = `Welcome to ${roomName}, ${userName}!`;
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
};

const handleUsernameSubmit = async (event) => {
  event.preventDefault();
  const input = usernameForm.querySelector("input");
  userName = input.value;
  const h2 = welcome.querySelector("h2");
  h2.innerText = `Welcome, User '${userName}'!`;
  usernameForm.hidden = true;
  input.value = "";
};

const handleWelcomeSubmit = async (event) => {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  if (userName === undefined) {
    alert("Please save your username before joining a room!");
  } else {
    await initCall(input.value);
    socket.emit("join_room", input.value, userName);
    roomName = input.value;
  }
  input.value = "";
};

usernameForm.addEventListener("submit", handleUsernameSubmit);
welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Chat

const chat = document.getElementById("chat");
const msgForm = chat.querySelector("form");
chat.hidden = true;

const addMessage = (message) => {
  const ul = chat.querySelector("ul");
  const li = document.createElement("li");
  li.innerText = `${message}`;
  ul.appendChild(li);
};

const handleMsgFormSubmitEvent = (event) => {
  event.preventDefault();
  const input = call.querySelector("#msg input");
  const value = input.value;
  myDataChannel.send(value);
  addMessage(`You: ${value}`);
  input.value = "";
};

msgForm.addEventListener("submit", handleMsgFormSubmitEvent);

// Sockets
socket.on("room_limit", (roomName) => {
  myStream.getTracks().forEach(function (track) {
    track.stop();
  });
  camerasSelect.innerHTML = "";
  myFace.innerHTML = "";
  welcome.hidden = false;
  call.hidden = true;
  alert(`'${roomName}' is already occupied. Try another room.`);
});

socket.on("welcome", async (peersUsername) => {
  const roomWelcomeMsg = document.getElementById("roomwelcome");
  roomWelcomeMsg.innerText = `Welcome to ${roomName}, ${userName}!`;
  myDataChannel = myPeerConnection.createDataChannel("chat");
  myDataChannel.addEventListener("message", (event) => {
    addMessage(`${peersUsername}: ${event.data}`);
  });
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  socket.emit("offer", offer, roomName, userName);
});

socket.on("offer", async (offer, peersUsername) => {
  myPeerConnection.addEventListener("datachannel", (event) => {
    myDataChannel = event.channel;
    myDataChannel.addEventListener("message", (event) => {
      addMessage(`${peersUsername}: ${event.data}`);
    });
  });
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName, userName);
  const h4 = document.getElementById("loading");
  h4.hidden = true;
  chat.hidden = false;
  const h2 = document.getElementById("peersusername");
  h2.innerText = `${peersUsername}`;
});

socket.on("answer", (answer, userName) => {
  const h4 = document.getElementById("loading");
  const h2 = document.getElementById("peersusername");
  h2.innerText = `${userName}`;
  h4.hidden = true;
  chat.hidden = false;
  const usernameDisplay = document.getElementById("peersusername");
  usernameDisplay.innerText = `${userName}`;
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  myPeerConnection.addIceCandidate(ice);
});

// WebRTC

const handleIce = (data) => {
  socket.emit("ice", data.candidate, roomName);
};

const handleAddStream = (data) => {
  peersFace.srcObject = data.streams[0];
};

const makeConnection = () => {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
        ],
      },
    ],
  });
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("track", handleAddStream);
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
};

// Modal (code adapted from https://www.w3schools.com/howto/howto_css_modals.asp)
const modal = document.getElementById("settingmodal");
const btn = document.getElementById("setting");
const span = document.getElementsByClassName("close")[0];

// When the user clicks on the button, open the modal
btn.onclick = function () {
  modal.style.display = "block";
};

// When the user clicks on <span> (x), close the modal
span.onclick = function () {
  modal.style.display = "none";
};

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
  if (event.target === modal) {
    modal.style.display = "none";
  }
};
