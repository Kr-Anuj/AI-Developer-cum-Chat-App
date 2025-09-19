import projectModel from '../models/project.model.js'
import mongoose from 'mongoose';

export const createProject = async ({ name, userId }) => {
    if (!name) {
        throw new Error('Name is required')
    }
    if (!userId) {
        throw new Error('UserId is Required')
    }
    let project;
    try {
        project = await projectModel.create({
            name,
            users: [userId]
        });
    } catch (error) {
        if (error.code === 11000) {
            throw new Error('Project name already exists');
        }
        throw error;
    }
    return project;
};

export const getAllProjectByUserId = async ({ userId }) => {
    if (!userId) {
        throw new Error('User Id is Required')
    }
    const allUserProjects = await projectModel.find({
        users: userId
    });
    return allUserProjects;
};

export const addUsersToProjects = async ({ projectId, users, userId }) => {
    if (!projectId) {
        throw new Error('Project ID is required')
    }
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid Project ID")
    }
    if (!users) {
        throw new Error('Users are required')
    }
    if (!Array.isArray(users) || users.some(userId => !mongoose.Types.ObjectId.isValid(userId))) {
        throw new Error("Invalid user ID(s) in user array")
    }
    if (!userId) {
        throw new Error("UserID is required");
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid UserID")
    }
    const project = await projectModel.findOne({
        _id: projectId,
        users: userId
    });
    if (!project) {
        throw new Error("User doesn't belong to this project")
    }
    const updatedProject = await projectModel.findByIdAndUpdate(
        projectId,
        { $addToSet: { users: { $each: users } } },
        { new: true }
    );
    return updatedProject;
};

export const getProjectById = async ({ projectId, userId }) => {
    if (!projectId) {
        throw new Error("ProjectID is required")
    }
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid ProjectID")
    }
    if (!userId) {
        throw new Error("UserID is required");
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid UserID");
    }
    const project = await projectModel.findOne({
        _id: projectId
    }).populate('users', 'email');
    if (!project) {
        throw new Error("No such project exists");
    }
    return project;
};

export const updateFileTree = async ({ projectId, fileTree }) => {
    if (!projectId) {
        throw new Error("Project ID is required")
    }
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid Project ID")
    }
    if (!fileTree) {
        throw new Error("FileTree is required")
    }
    const project = await projectModel.findOneAndUpdate({
        _id: projectId
    }, {
        fileTree
    }, {
        new: true
    });
    return project;
};

export const saveProjectState = async ({ projectId, fileTree, messages }) => {
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error('A valid Project ID is required.');
    }
    try {
        const updateData = {};
        if (fileTree !== undefined) {
            updateData.fileTree = fileTree;
        }
        if (messages !== undefined) {
            updateData.messages = messages;
        }
        const project = await projectModel.findByIdAndUpdate(
            projectId,
            { $set: updateData },
            { new: true, runValidators: true }
        );
        if (!project) {
            throw new Error('Project not found.');
        }
        return project;
    } catch (error) {
        throw new Error(error.message);
    }
};

export const addMessageToProject = async ({ projectId, user, message }) => {
    if (!projectId || !user || !message) {
        throw new Error('Project ID, user, and message are required.');
    }

    const newMessage = {
        user,
        message,
        timestamp: new Date(),
    };

    const updatedProject = await projectModel.findByIdAndUpdate(
        projectId,
        { $push: { messages: newMessage } },
        { new: true, runValidators: true, select: { messages: { $slice: -1 } } }
    ).lean();

    if (!updatedProject || !updatedProject.messages || updatedProject.messages.length === 0) {
        throw new Error('Failed to save message or find project.');
    }

    // The query returns the project with only the last message. We return that message object.
    return updatedProject.messages[0];
};

export const deleteMessages = async ({ projectId, messageIds }) => {
    try {
        const project = await projectModel.findById(projectId);
        if (!project) {
            throw new Error('Project not found.');
        }

        // Filter the messages array, keeping only the ones whose IDs are NOT in the messageIds array
        project.messages = project.messages.filter(
            (message) => !messageIds.includes(message._id.toString())
        );

        // Save the updated project document
        await project.save();

        return project;
    } catch (error) {
        throw new Error(error.message);
    }
};