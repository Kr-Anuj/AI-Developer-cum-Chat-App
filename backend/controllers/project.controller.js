import projectModel from '../models/project.model.js';
import * as projectService from '../services/project.service.js';
import userModel from '../models/user.model.js';
import { validationResult } from 'express-validator';

export const createProject = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { name } = req.body;
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        const newProject = await projectService.createProject({ name, userId: loggedInUser._id });
        res.status(201).json(newProject);
    } catch (err) {
        res.status(400).send(err.message);
    }
};

export const getAllProject = async (req, res) => {
    try {
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        const allUserProjects = await projectService.getAllProjectByUserId({ userId: loggedInUser._id });
        res.status(200).json({ projects: allUserProjects });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

export const addUserToProject = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { users, projectId } = req.body;
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        const project = await projectService.addUsersToProjects({
            projectId,
            users,
            userId: loggedInUser._id
        });
        res.status(200).json({ project });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

export const getProjectById = async (req, res) => {
    const { projectId } = req.params;
    try {
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        const project = await projectService.getProjectById({
            projectId,
            userId: loggedInUser._id
        });
        res.status(200).json({ project });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

export const updateFileTree = async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { projectId, fileTree } = req.body;
        const project = await projectService.updateFileTree({
            projectId,
            fileTree
        });
        res.status(200).json({ project });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

export const saveProjectState = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { fileTree, selectedMessages } = req.body;
        if (!fileTree && !selectedMessages) {
            return res.status(400).json({ message: "No data provided to save." });
        }
        const updatedProject = await projectService.saveProjectState({
            projectId,
            fileTree,
            messages: selectedMessages,
        });
        res.status(200).json({
            message: "Project saved successfully!",
            project: updatedProject,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- DELETE FUNCTION ---
export const deleteMessages = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { messageIds } = req.body;

        if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ message: 'Message IDs must be a non-empty array.' });
        }

        await projectService.deleteMessages({ projectId, messageIds });

        const io = req.app.get('io');
        io.to(projectId).emit('messages-deleted', { messageIds });

        res.status(200).json({ message: 'Messages deleted successfully.' });
    } catch (error) {
        console.error("Error deleting messages:", error);
        res.status(500).json({ message: 'Server error while deleting messages.' });
    }
};