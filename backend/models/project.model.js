import mongoose from 'mongoose';

const { Schema } = mongoose; // ✅ Destructure Schema from mongoose

const projectSchema = new Schema({
    name: {
        type: String,
        lowercase: true,
        required: true,
        trim: true,
        unique: [true, 'Project name already exists'],
    },

    users: [{
        type: Schema.Types.ObjectId,
        ref: 'user',
    }],

    fileTree: {
        type: Schema.Types.Mixed,  // ✅ Now Schema is defined
        default: {}
    }
}, { timestamps: true, minimize: false }); // ✅ Recommended to prevent empty object stripping

const Project = mongoose.model('project', projectSchema);

export default Project;
