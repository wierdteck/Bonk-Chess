// src/socket.js
import { io } from "socket.io-client";

// Connect to your backend server
const socket = io("http://localhost:3000"); // backend URL and port
export default socket;
