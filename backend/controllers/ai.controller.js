import * as ai from '../services/ai.service.js';

export const getResult = async (req, res) => {
    try {
        const { prompt } = req.query;
        const result = await ai.generateResult(prompt);
        res.send({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error generating result:', error);
        res.status(500).send({
            success: false,
            message: 'Failed to generate result',
            error: error.message
        });
    }
}