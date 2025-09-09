import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_KEY });

export const generateResult = async (prompt) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            files: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  content: { type: Type.STRING },
                },
                required: ["name", "content"],
              },
            },
            buildCommand: {
              type: Type.OBJECT,
              properties: {
                mainItem: { type: Type.STRING },
                commands: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ["mainItem", "commands"],
            },
            startCommand: {
              type: Type.OBJECT,
              properties: {
                mainItem: { type: Type.STRING },
                commands: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ["mainItem", "commands"],
            },
          },
          required: ["text", "files"],
        },
      },
      toolsConfig: {
        systemInstruction: {
          role: "system",
          parts: [
            {
              text: `1. You are an expert in MERN stack development with 10 years of experience. You always write code in a modular form and break it down in all possible ways. You always follow best practices. Use understandable comments in the code and create files as needed. You always write code in the context of the previous code, while maintaining its working state. You always follow the best practices in software development and never miss edge cases. You always write code that is scalable and maintainable. In your code, you always handle all possible errors and exceptions very well. Crucially, when providing file content, ensure the code is properly formatted with consistent indentation (e.g., 2 or 4 spaces) and appropriate line breaks for readability. Do not put entire code files on a single line. ALWAYS include a package.json with ALL required dependencies. For Express projects, MUST include "express" in dependencies. 
              ALWAYS include a package.json file with ALL required dependencies. 
              For Express projects, MUST include "express" in dependencies.
              Respond ONLY with JSON containing:
              - "text": Explanation of the solution
              - "files": Array of {name: "filename", content: "file content"}
              - "buildCommand": {mainItem: "npm", commands: ["install"]} (if needed)
              - "startCommand": {mainItem: "npm", commands: ["start"]} (if needed)

              2. When creating or modifying files, the 'fileTree' object in your response should ONLY contain the new or updated files. Do NOT return the entire existing file tree.
    
    Examples: 
    <example>
   
    response: {
    "text": "this is you fileTree structure of the express server",
    "fileTree": {
        "app.js": {
            file: {
                contents: "
                const express = require('express');

                const app = express();

                app.get('/', (req, res) => {
                    res.send('Hello World!');
                });

                app.listen(3000, () => {
                    console.log('Server is running on port 3000');
                })
                "
            }
        },

        "package.json": {
            file: {
                contents: "

                {
                    "name": "temp-server",
                    "version": "1.0.0",
                    "main": "index.js",
                    "scripts": {
                        "test": "echo \"Error: no test specified\" && exit 1"
                    },
                    "keywords": [],
                    "author": "",
                    "license": "ISC",
                    "description": "",
                    "dependencies": {
                        "express": "^4.21.2"
                    }
                }

                "
            }

        },

    },
    "buildCommand": {
        mainItem: "npm",
            commands: [ "install" ]
    },

    "startCommand": {
        mainItem: "node",
            commands: [ "app.js" ]
    }
}

    user:Create an express application 
    
    </example>

        <example>

        user:Hello 
        response:{
        "text":"Hello, How can I help you today?"
        }
        
        </example>
        IMPORTANT: Don't use file names likes routes/index.js .
        IMPORTANT: In "buildCommand" and "startCommand", the "mainItem" must be a valid CLI tool (like "npm", "node", or "yarn"). Do NOT use filenames like "package.json" as mainItem.`
            },
          ],
        },
      },
    });

    let result;
    try {
      result = JSON.parse(response.text);
    } catch (err) {
      throw new Error("AI returned invalid JSON: " + response.text);
    }

    // Validate package.json contains express for Node.js projects
    if (result.files) {
      const pkgFile = result.files.find(f => f.name === 'package.json');
      if (pkgFile) {
        try {
          const pkg = JSON.parse(pkgFile.content);
          if (pkg.dependencies && !pkg.dependencies.express) {
            console.warn("Express missing in package.json, adding it...");
            pkg.dependencies.express = pkg.dependencies.express || "^4.18.3";
            pkgFile.content = JSON.stringify(pkg, null, 2);
          }
        } catch (e) {
          console.error("Error parsing package.json:", e);
        }
      }
    }

    const fileTree = {};
    if (result.files && Array.isArray(result.files)) {
      result.files.forEach(file => {
        fileTree[file.name] = {
          file: { contents: file.content }
        };
      });
    }

    // Sanity-check startCommand and buildCommand
    const validCommands = ["npm", "node", "yarn", "pnpm", "bun"];

    ["buildCommand", "startCommand"].forEach(cmdKey => {
      if (result[cmdKey] && !validCommands.includes(result[cmdKey].mainItem)) {
        console.warn(`Invalid ${cmdKey}.mainItem: ${result[cmdKey].mainItem}, resetting to default`);
        if (cmdKey === "buildCommand") {
          result[cmdKey] = { mainItem: "npm", commands: ["install"] };
        } else {
          result[cmdKey] = { mainItem: "npm", commands: ["start"] };
        }
      }
    });


    const finalResult = {
      text: result.text || "",
      fileTree: fileTree,
      buildCommand: result.buildCommand || null,
      startCommand: result.startCommand || null
    };

    console.log("AI Response Parsed:", finalResult);
    return finalResult;
  } catch (error) {
    console.error("Error generating result:", error);
    throw new Error("AI service failed: " + error.message);
  }
};