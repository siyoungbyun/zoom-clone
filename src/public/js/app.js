const socket = io();

const welcome = document.getElementById("welcome");
const login = document.getElementById("login");
const userForm = document.getElementById("user");
const roomNameForm = welcome.querySelector("#roomname");
const room = document.getElementById("room");
const table = welcome.querySelector("table");
const leaveButton = room.querySelector("#leave");

room.hidden = true;
login.hidden = true;

let roomName;
let userName;

const addMessage = (message) => {
  const ul = room.querySelector("ul");
  const li = document.createElement("li");
  li.innerText = `[${new Date().toISOString()}] ${message}`;
  ul.appendChild(li);
};

const handleMsgFormSubmitEvent = (event) => {
  event.preventDefault();
  const input = room.querySelector("#msg input");
  const value = input.value;
  socket.emit("new_message", input.value, roomName, () => {
    addMessage(`You: ${value}`);
  });
  input.value = "";
};

const showRoom = (roomSize) => {
  welcome.hidden = true;
  room.hidden = false;
  const h3 = room.querySelector("h3");
  h3.innerText = `Room '${roomName}' - ${roomSize} user(s)`;
  const msgForm = room.querySelector("#msg");
  msgForm.addEventListener("submit", handleMsgFormSubmitEvent);
};

const handleRoomEnterSubmitEvent = (event) => {
  event.preventDefault();
  if (userName === undefined) {
    alert("Please save your username first!");
  } else {
    const roomNameInput = roomNameForm.querySelector("input");
    roomName = roomNameInput.value;
    socket.emit("enter_room", roomNameInput.value, showRoom);
    addMessage(`You have entered the room as '${userName}'`);
    roomNameInput.value = "";
  }
};

roomNameForm.addEventListener("submit", handleRoomEnterSubmitEvent);

const displayUserName = () => {
  login.hidden = false;
  const userNameButton = userForm.querySelector("button");
  userNameButton.innerHTML = "Change";
  const h3 = login.querySelector("h3");
  h3.innerText = `Welcome, ${userName}!`;
};

const handleUserNameSaveEvent = (event) => {
  event.preventDefault();
  const userNameInput = userForm.querySelector("input");
  userName = userNameInput.value;
  socket.emit("set_username", userName, displayUserName);
  userNameInput.value = "";
};

userForm.addEventListener("submit", handleUserNameSaveEvent);

socket.on("welcome", (user, newCount) => {
  addMessage(`'${user}' has entered the room!`);
  const h3 = room.querySelector("h3");
  h3.innerText = `Room '${roomName}' - ${newCount} user(s)`;
});

socket.on("bye", (left, newCount) => {
  addMessage(`'${left}' left the room!`);
  const h3 = room.querySelector("h3");
  h3.innerText = `Room '${roomName}' - ${newCount} user(s)`;
});

socket.on("new_message", addMessage);

socket.on("room_change", (rooms) => {
  const h4 = welcome.querySelector("h4");
  h4.innerText = `Currently there are ${rooms.length} open room(s):`;
  table.innerHTML = "";
  rooms.forEach((roomInfo) => {
    const [room, value] = roomInfo;
    const tr = document.createElement("tr");
    const roomName = document.createElement("th");
    const roomSize = document.createElement("th");
    const joinRow = document.createElement("th");
    roomName.innerText = room;
    tr.appendChild(roomName);
    roomSize.innerText = `${value} user(s)`;
    tr.appendChild(roomSize);
    const joinButton = document.createElement("button");
    joinButton.innerText = "Join";
    joinButton.id = room;
    joinRow.appendChild(joinButton);
    tr.appendChild(joinRow);
    table.append(tr);
  });
});

const handleRoomJoinEvent = (event) => {
  event.preventDefault();
  if (userName === undefined) {
    alert("Please save your username first!");
  } else {
    roomName = event.target.id;
    if (roomName === "") {
      return;
    }
    socket.emit("enter_room", event.target.id, showRoom);
    addMessage(`You have entered the room as '${userName}'`);
  }
};

table.addEventListener("click", handleRoomJoinEvent);

const displayLobby = () => {
  welcome.hidden = false;
  room.hidden = true;
  const ul = room.querySelector("ul");
  ul.innerHTML = "";
};

const handleRoomLeaveEvent = (event) => {
  event.preventDefault();
  socket.emit("leave_room", roomName, displayLobby);
  roomName = "";
};

leaveButton.addEventListener("click", handleRoomLeaveEvent);
