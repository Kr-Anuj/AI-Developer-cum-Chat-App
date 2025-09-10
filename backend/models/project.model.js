import mongoose from 'mongoose';

const { Schema } = mongoose;

// Dedicated schema for messages
const messageSchema = new Schema({
    user: { type: Object, required: true },
    message: { type: Object, required: true },
    timestamp: { type: Date, default: Date.now }
}, { 
    _id: true, // Ensure _id is created for each message subdocument
    timestamps: false // We use our own timestamp field, so disable this for the sub-schema
});

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
        type: Object,
        default: {}
    },
    // Use the messageSchema for the messages array
    messages: [messageSchema]
}, { timestamps: true, minimize: false });

const Project = mongoose.model('project', projectSchema);

export default Project;