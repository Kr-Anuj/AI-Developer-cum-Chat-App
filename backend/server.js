import 'dotenv/config.js';
import http from 'http';
import app from './app.js';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import projectModel from './models/project.model.js';
import { generateResult } from './services/ai.service.js';

const port = process.env.PORT || 3000;


const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

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
        socket.user = decoded; // Attach user info to the socket
        next();
    } catch (error) {
        next(error)
    }
})

io.on('connection', socket => {
    socket.roomId = socket.project._id.toString()
    console.log('A user connected:', socket.id);
    socket.join(socket.roomId); // Join the project room
    socket.on('project-message', async data => {
        const message = data.message;
        // console.log('message', data);
        const messageText = message?.text || "";
        const aiIsPresentInMessage = messageText.includes('@ai') || messageText.includes('@AI') || messageText.includes('@Ai') || messageText.includes('@aI');

        socket.broadcast.to(socket.roomId).emit('project-message', {
            user: socket.user,
            message: data.message,
            timestamp: new Date()
        });
        if (aiIsPresentInMessage) {
            const prompt = messageText.replace(/@ai/gi, '').trim();

            const result = await generateResult(prompt);
            io.to(socket.roomId).emit('project-message', {
                message: result,
                user: {
                    id: 'ai',
                    email: 'AI Assistant'
                }
            })
            return;
        }
    })
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        socket.leave(socket.roomId); // Leave the project room
    });
});


server.listen(port, () => {
    console.log(`Server is Running on port ${port}`);
})