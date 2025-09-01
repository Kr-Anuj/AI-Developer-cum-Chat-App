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
        const userId = loggedInUser._id;
        const newProject = await projectService.createProject({ name, userId });
        res.status(201).json(newProject);
    } catch (err) {
        console.log(err);
        res.status(400).send(err.message);
    }


}

export const getAllProject = async (req, res) => {
    try {
        const loggedInUser = await userModel.findOne({
            email: req.user.email
        })
        const allUserProjects = await projectService.getAllProjectByUserId({
            userId: loggedInUser._id
        })
        return res.status(200).json({
            projects: allUserProjects
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }
}

export const addUserToProject = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { users, projectId } = req.body;
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        const userId = loggedInUser._id;
        const project = await projectService.addUsersToProjects({
            projectId,
            users,
            userId: loggedInUser._id
        })
        return res.status(200).json({
            project,
        })
    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message });
    }
}

export const getProjectById = async (req, res) => {
    const { projectId } = req.params;
    try {
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        const project = await projectService.getProjectById({
            projectId,
            userId: loggedInUser._id
        });
        return res.status(200).json({
            project
        })
    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }
}

export const updateFileTree = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { projectId, fileTree } = req.body;
        console.log('Received fileTree:', fileTree);
        console.log('For projectId:', projectId);
        const project = await projectService.updateFileTree({
            projectId,
            fileTree
        })
        return res.status(200).json({
            project
        })
    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }
}

export const saveProjectState = async (req, res) => {
  try {
    const { projectId } = req.params; // Get ID from the URL parameter
    const { fileTree, selectedMessages } = req.body; // Get data from the request body

    // Basic validation to ensure there's something to save
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
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};
