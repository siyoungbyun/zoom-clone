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

const countRoom = (roomName) => {
  return ioServer.sockets.adapter.rooms.get(roomName)?.size;
};

ioServer.on("connection", (socket) => {
  socket.on("join_room", (roomName, userName) => {
    if (countRoom(roomName) >= 2) {
      socket.emit("room_limit", roomName);
    } else {
      socket.join(roomName);
      socket.to(roomName).emit("welcome", userName);
    }
  });
  socket.on("offer", (offer, roomName, userName) => {
    socket.to(roomName).emit("offer", offer, userName);
  });
  socket.on("answer", (answer, roomName, userName) => {
    socket.to(roomName).emit("answer", answer, userName);
  });
  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
  });
});
httpServer.listen(PORT, HOST, handleListen);
