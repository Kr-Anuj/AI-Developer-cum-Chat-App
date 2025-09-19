import 'dotenv/config.js';
import http from 'http';
import app from './app.js';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import projectModel from './models/project.model.js';
import { generateResult } from './services/ai.service.js';
import * as projectService from './services/project.service.js';

const port = process.env.PORT || 3000;
const server = http.createServer(app);

// Creating a variable to track active users
const activeUsers = {}; // Example: { 'roomId': ['user1@email.com', 'user2@email.com'] }

const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN,
        methods: ["GET", "POST"]
    }
});
app.set('io', io);

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];
        const projectId = socket.handshake.query.projectId;
        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return next(new Error('Invalid Project ID'));
        }
        socket.project = await projectModel.findById(projectId);
        if (!token) {
            return next(new Error('Authentication Error'))
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return next(new Error('Authentication Error'));
        }
        socket.user = decoded;
        next();
    } catch (error) {
        next(error)
    }
});

io.on('connection', socket => {
    socket.roomId = socket.project._id.toString();
    console.log('A user connected:', socket.id, 'to room:', socket.roomId);
    socket.join(socket.roomId);

    // To handle user joining the room
    if (!activeUsers[socket.roomId]) {
        activeUsers[socket.roomId] = [];
    }
    // Adding user to the room's active list if they're not already there
    if (!activeUsers[socket.roomId].includes(socket.user.email)) {
        activeUsers[socket.roomId].push(socket.user.email);
    }
    // Broadcasting the updated list of active users to everyone in the room
    io.to(socket.roomId).emit('update-active-users', activeUsers[socket.roomId]);


    socket.on('project-message', async (data) => {
        try {
            const { message, user } = data;
            const projectId = socket.roomId;

            // Saving the new message to the database
            const savedMessage = await projectService.addMessageToProject({
                projectId,
                user,
                message
            });

             console.log('BACKEND: Broadcasting message with _id:', savedMessage._id, 'to room:', projectId);

            // Broadcasting the complete, saved message to everyone in the room
            io.to(projectId).emit('project-message', savedMessage);

            // Handling the AI interaction when required
            const messageText = message?.text || "";
            const aiIsPresentInMessage = /@ai/gi.test(messageText);

            if (aiIsPresentInMessage) {
                const prompt = messageText.replace(/@ai/gi, '').trim();
                const result = await generateResult(prompt);

                const aiMessagePayload = {
                    message: result,
                    user: { id: 'ai', email: 'AI Assistant' }
                };

                // Saving the AI's response to the database
                const savedAiMessage = await projectService.addMessageToProject({
                    projectId,
                    user: aiMessagePayload.user,
                    message: aiMessagePayload.message,
                });

                // Broadcasting the saved AI message
                io.to(projectId).emit('project-message', savedAiMessage);
            }
        } catch (error) {
            console.error('Error handling project message:', error);
            // Optionally, emit an error back to the sender
            socket.emit('message-error', { error: 'Failed to send message.' });
        }
    });

    socket.on('typing', () => {
        socket.broadcast.to(socket.roomId).emit('typing', { email: socket.user.email });
    });

    socket.on('stop typing', () => {
        socket.broadcast.to(socket.roomId).emit('stop typing', { email: socket.user.email });
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id, 'from room:', socket.roomId);

        // To handle user leaving the room
        if (activeUsers[socket.roomId]) {
            // Removing the user from the list
            activeUsers[socket.roomId] = activeUsers[socket.roomId].filter(
                email => email !== socket.user.email
            );
            // Broadcasting the updated list to the remaining users
            io.to(socket.roomId).emit('update-active-users', activeUsers[socket.roomId]);

            // Cleaning up empty room arrays
            if (activeUsers[socket.roomId].length === 0) {
                delete activeUsers[socket.roomId];
            }
        }

        socket.broadcast.to(socket.roomId).emit('stop typing', { email: socket.user.email });
        socket.leave(socket.roomId);
    });
});

const startServer = async () => {
    try {
        server.listen(port, () => {
            console.log(`Server is Running on port ${port}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();