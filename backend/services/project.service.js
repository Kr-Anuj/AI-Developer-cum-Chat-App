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

// --- DELETE MESSAGES ---
// This function checks permissions before deletion
export const deleteMessages = async ({ projectId, messageIds, userId }) => {
    try {
        // 1. Find the project
        const project = await projectModel.findById(projectId);
        if (!project) {
            throw new Error('Project not found.');
        }

        // Convert the user's ID to a string one time
        const userIdString = userId.toString();

        // 2. Check permissions for *every* message
        for (const msgId of messageIds) {
            const message = project.messages.id(msgId);

            // If message was already deleted, skip it
            if (!message) {
                continue;
            }

            // --- THE PERMISSION LOGIC ---
            
            // Check if message.user and message.user._id exist
            if (message.user && message.user._id) {
                if (message.user._id.toString() === userIdString) {
                    // It's the user's own message. Allow deletion.
                    continue;
                } else {
                    // It's *another user's* message. FORBIDDEN.
                    throw new Error('FORBIDDEN');
                }
            } else {
                // --- This is an AI Message ---
                // Allow anyone to delete AI messages.
                // So, just 'continue' and allow it.
                continue;
            }
        }

        // 3. If the loop completes, all deletions are allowed.
        await projectModel.updateOne(
            { _id: projectId },
            {
                $pull: {
                    messages: { _id: { $in: messageIds } }
                }
            }
        );

    } catch (error) {
        throw error;
    }
};