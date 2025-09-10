import userModel from '../models/user.model.js';

export const createUser = async ({ email, password }) => {
    if (!email || !password) {
        throw new Error('Email and Password are required');
    }

    // The pre('save') hook in user model will automatically hash it before saving.
    const user = await userModel.create({
        email,
        password 
    });

    return user;
};

export const getAllUsers = async ({ userId }) => {
    const users = await userModel.find({
        _id: { $ne: userId }
    });
    return users;
};