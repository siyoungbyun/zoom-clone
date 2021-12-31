import express from "express";
import http from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || "localhost";
const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

const handleListen = () =>
  console.log(`Listening on http://${HOST}:${PORT}...`);

const httpServer = http.createServer(app);
const ioServer = new Server(httpServer, {
  cors: {
    origin: ["https://admin.socket.io"],
    credentials: true,
  },
});

instrument(ioServer, {
  auth: false,
});

const publicRooms = () => {
  const {
    sockets: {
      adapter: { sids, rooms },
    },
  } = ioServer;
  const publicRooms = [];
  rooms.forEach((value, key) => {
    if (sids.get(key) === undefined) {
      publicRooms.push([key, value.size]);
    }
  });
  return publicRooms;
};

const countRoom = (roomName) => {
  return ioServer.sockets.adapter.rooms.get(roomName)?.size;
};

ioServer.on("connection", (socket) => {
  socket.on("set_username", (userName, displayUserName) => {
    socket["nickname"] = userName;
    ioServer.sockets.emit("room_change", publicRooms());
    displayUserName();
  });
  socket.on("enter_room", (roomName, showRoom) => {
    socket.join(roomName);
    const roomSize = countRoom(roomName);
    showRoom(roomSize);
    socket.to(roomName).emit("welcome", socket.nickname, roomSize);
    ioServer.sockets.emit("room_change", publicRooms());
  });
  socket.on("leave_room", (roomName, displayLobby) => {
    socket.rooms.forEach((room) => {
      socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1);
    });
    socket.leave(roomName);
    ioServer.sockets.emit("room_change", publicRooms());
    displayLobby();
  });
  socket.on("disconnecting", () => {
    socket.rooms.forEach((room) => {
      socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1);
    });
  });
  socket.on("disconnect", () => {
    ioServer.sockets.emit("room_change", publicRooms());
  });
  socket.on("new_message", (msg, room, done) => {
    socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
    done();
  });
});

httpServer.listen(PORT, HOST, handleListen);
