import React, { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from '../config/axios.js'
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket.js'
import { UserContext } from '../context/user.context'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js'
import { getWebContainer } from '../config/webContainer.js'
import { debounce } from 'lodash'
import { toast } from 'react-toastify';

// Helper function to remove terminal color/formatting codes for clean display
const stripAnsiCodes = (str) => str.replace(/[\u001b\u009b][[()#;?]*.{0,2}(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');


function parseCommand(cmdObj) {
    if (!cmdObj) return null;
    let cmd = cmdObj.mainItem;
    let args = Array.isArray(cmdObj.commands) ? cmdObj.commands : [];
    if (typeof cmd === 'string' && cmd.trim().includes(' ')) {
        const [first, ...rest] = cmd.trim().split(/\s+/);
        cmd = first;
        args = [...rest, ...args];
    }
    return [cmd, ...args];
}


function parseStartCommand(startCommand) {
    if (!startCommand) return ['npm', 'start'];
    let cmd = startCommand.mainItem;
    let args = Array.isArray(startCommand.commands) ? startCommand.commands : [];

    if (typeof cmd === 'string' && cmd.trim().includes(' ')) {
        const [first, ...rest] = cmd.trim().split(/\s+/);
        cmd = first;
        args = [...rest, ...args];
    }
    return [cmd, ...args];
}

function SyntaxHighLightedCode(props) {
    const ref = useRef(null)
    React.useEffect(() => {
        if (ref.current && props.className?.includes('lang-') && window.hljs) {
            window.hljs.highlightElement(ref.current)
            ref.current.removeAttribute('data-highlighted')
        }
    }, [props.className, props.children])
    return <code {...props} ref={ref} />
}

const getLanguage = (filename) => {
    if (!filename) return 'plaintext'
    if (filename.endsWith('.js')) return 'javascript'
    if (filename.endsWith('.json')) return 'json'
    if (filename.endsWith('.ts')) return 'typescript'
    if (filename.endsWith('.jsx')) return 'jsx'
    if (filename.endsWith('.tsx')) return 'tsx'
    if (filename.endsWith('.css')) return 'css'
    if (filename.endsWith('.html')) return 'html'
    return 'plaintext'
}


const Project = () => {
    const location = useLocation();
    const { user } = useContext(UserContext);

    // Component State
    const [project, setProject] = useState(location.state.project);
    const [messages, setMessages] = useState([]);
    const [fileTree, setFileTree] = useState({});
    const [currentFile, setCurrentFile] = useState(null);
    const [openFiles, setOpenFiles] = useState([]);
    const [message, setMessage] = useState('');
    const [users, setUsers] = useState([]);
    const [activeUsers, setActiveUsers] = useState([]);

    // UI State
    const [isSidePanelOpen, setisSidePanelOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState('saved');
    const [typingUsers, setTypingUsers] = useState({});


    // State for selections in modals
    const [selectedUserId, setSelectedUserId] = useState(new Set());
    const [selectedMessages, setSelectedMessages] = useState(new Set());
    const [messagesToDelete, setMessagesToDelete] = useState(new Set());

    // WebContainer State
    const [webContainer, setWebContainer] = useState(null);
    const [iframeUrl, setIframeUrl] = useState(null);
    const [serverProc, setServerProc] = useState(null);
    const [serverStatus, setServerStatus] = useState('');
    const [isWebContainerReady, setIsWebContainerReady] = useState(false);


    // Refs
    const messageBox = useRef();
    const isInitialMount = useRef(true);
    const typingTimeouts = useRef({});


    // Debounced auto-save function
    const autoSaveProject = useRef(
        debounce((latestFileTree, latestMessages, currentProject) => {
            setSaveStatus('saving');
            const payload = {
                fileTree: latestFileTree,
                selectedMessages: latestMessages
            };
            axios.patch(`/projects/${currentProject._id}/save`, payload)
                .then(() => {
                    setSaveStatus('saved');
                })
                .catch(err => {
                    console.error("Auto-save failed:", err);
                    setSaveStatus('dirty');
                });
        }, 3000)
    ).current;

    // --- Handlers ---
    const emitTyping = useRef(debounce(() => {
        sendMessage('typing');
    }, 300)).current;

    const emitStopTyping = useRef(debounce(() => {
        sendMessage('stop typing');
    }, 2000)).current;

    const send = () => {
        if (!message.trim()) return;
        sendMessage('project-message', {
            message: { text: message },
            user
        });
        setMessage('');
        emitTyping.cancel();
        emitStopTyping.cancel();
        sendMessage('stop typing');
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setMessage(value);

        if (value) {
            emitTyping();
            emitStopTyping();
        } else {
            emitTyping.cancel();
            emitStopTyping.cancel();
            sendMessage('stop typing');
        }
    };

    const handleUserSelect = (id) => {
        setSelectedUserId(prev => {
            const updated = new Set(prev)
            updated.has(id) ? updated.delete(id) : updated.add(id)
            return updated
        })
    }

    function addcollaborators() {
        axios.put("/projects/add-user", {
            projectId: location.state.project._id,
            users: Array.from(selectedUserId)
        }).then(res => {
            setIsModalOpen(false)
        }).catch(err => {
            console.log(err)
        })
    }

    const handleMessageSelection = (message, isChecked) => {
        setSelectedMessages(prev => {
            const newSet = new Set(prev);
            if (isChecked) newSet.add(message);
            else newSet.delete(message);
            return newSet;
        });
    };

    const handleSaveProject = async () => {
        const messagesToSave = Array.from(selectedMessages);
        const payload = { fileTree, selectedMessages: messagesToSave };
        try {
            setSaveStatus('saving');
            await axios.patch(`/projects/${project._id}/save`, payload);
            toast.success("Project saved successfully!");
            setIsSaveModalOpen(false);
            setSaveStatus('saved');
        } catch (error) {
            console.error("Failed to save project:", error);
            toast.error("Error saving project.");
            setSaveStatus('dirty');
        }
    };

    const handleMessageDeletionSelection = (message, isChecked) => {
        setMessagesToDelete(prev => {
            const newSet = new Set(prev);
            if (isChecked) newSet.add(message);
            else newSet.delete(message);
            return newSet;
        });
    };

    const handleDeleteMessages = async () => {
        const messagesToDeleteArray = Array.from(messagesToDelete);
        const messageIds = messagesToDeleteArray.map(msg => msg._id).filter(id => id);

        if (messageIds.length === 0) {
            toast.info("No saved messages selected to delete.");
            return;
        }

        if (window.confirm("Are you sure you want to permanently delete the selected messages?")) {
            try {
                await axios.patch(`/projects/${project._id}/messages/delete`, { messageIds });
                toast.success("Messages deleted successfully.");
                setIsDeleteModalOpen(false);
            } catch (error) {
                console.error("Failed to delete messages:", error);
                // --- MODIFIED ERROR MESSAGE ---
                // Give specific feedback from the server if it exists
                const errorMsg = error.response?.data?.message || "Error deleting messages.";
                toast.error(errorMsg);
                // --- END MODIFICATION ---
            }
        }
    };

    const handleStopServer = async () => {
        if (!isWebContainerReady) {
            toast.error("Please Wait! WebContainer is being initialised");
            return;
        }
        if (serverProc) {
            setServerStatus('⏳ Stopping the currently running server...');
            try {
                await serverProc.kill();
                setServerProc(null);
                setIframeUrl(null);
                setServerStatus('✅ Server Stopped Successfully');
                setTimeout(() => {
                    if (isWebContainerReady) {
                        setServerStatus('✅ WebContainer initialised successfully');
                    } else {
                        setServerStatus('');
                    }
                }, 3000);
            } catch (e) {
                console.warn("Failed to stop server:", e);
                setServerStatus('❌ Failed to stop server');
                toast.error("Failed to stop the server.");
            }
        } else {
            toast.info("No server is currently running.");
        }
    };

    const handleRunServer = async () => {
        if (!isWebContainerReady) {
            toast.error("Please Wait! WebContainer is being initialised");
            return;
        }

        if (!webContainer) {
            console.error("WebContainer not ready.");
            setServerStatus('⚠️ WebContainer not ready');
            return;
        }

        try {
            setServerStatus('⏳ Mounting files...');
            await webContainer.mount(fileTree);

            const aiMsg = messages.slice().reverse().find(msg => msg.user?.id === 'ai' && (msg.message?.buildCommand || msg.message?.startCommand))?.message;
            let buildArr;

            if (fileTree['package.json']?.file?.contents) {
                try {
                    const pkgJson = JSON.parse(fileTree['package.json'].file.contents);
                    const dependencies = Object.keys(pkgJson.dependencies || {});
                    const devDependencies = Object.keys(pkgJson.devDependencies || {});
                    const allDeps = [...dependencies, ...devDependencies];

                    if (allDeps.length > 0) {
                        buildArr = ['pnpm', 'add', ...allDeps];
                    } else {
                        buildArr = null;
                    }
                } catch (e) {
                    console.error("Failed to parse package.json, falling back to default install.", e);
                    buildArr = parseCommand(aiMsg?.buildCommand || { mainItem: 'pnpm', commands: ['install'] });
                }
            } else {
                buildArr = parseCommand(aiMsg?.buildCommand || null);
            }

            if (buildArr) {
                let buildLogs = '';
                setServerStatus('🛠️ Installing Dependencies...');
                let buildProc;

                try {
                    // Attempting to use the primary command (pnpm)
                    buildProc = await webContainer.spawn(buildArr[0], buildArr.slice(1));
                } catch (err) {
                    // If command not found (e.g., pnpm failed to download), fall back to npm
                    if (err.message.includes('ENOENT')) {
                        console.warn(`'${buildArr[0]}' command failed or not found. Falling back to npm.`);
                        setServerStatus(`'${buildArr[0]}'❌ failed, falling back to npm...`);
                        const fallbackCommand = ['npm', 'install', '--legacy-peer-deps'];
                        buildProc = await webContainer.spawn(fallbackCommand[0], fallbackCommand.slice(1));
                    } else {
                        // For any other error, re-throw it to be caught by the outer catch block
                        throw err;
                    }
                }

                buildProc.output.pipeTo(new WritableStream({
                    write(chunk) {
                        buildLogs += chunk;
                    }
                }));

                const exitCode = await buildProc.exit;

                if (exitCode !== 0) {
                    const cleanLogs = stripAnsiCodes(buildLogs);
                    const packageJsonContent = fileTree['package.json']?.file?.contents || 'package.json not found.';

                    setServerStatus(`❌ Build failed with exit code ${exitCode}`);
                    console.error(`❌ Build process failed. Logs:\n${cleanLogs}`);

                    toast.error(
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            <p className="font-bold">Build process failed with exit code {exitCode}.</p>

                            <h4 className="font-semibold mt-4 mb-1">Installer Log:</h4>
                            <pre className='bg-gray-800 text-white p-2 rounded-md text-xs whitespace-pre-wrap break-all'>
                                {cleanLogs.slice(-1000)}
                            </pre>

                            <h4 className="font-semibold mt-4 mb-1">package.json:</h4>
                            <pre className='bg-gray-800 text-white p-2 rounded-md text-xs whitespace-pre-wrap break-all'>
                                {packageJsonContent}
                            </pre>
                        </div>,
                        { autoClose: false, style: { width: '600px' } }
                    );
                    return;
                }
            }

            if (serverProc) { try { await serverProc.kill(); } catch (e) { console.warn("Failed to kill previous server:", e); } }

            const startCommand = aiMsg?.startCommand || { mainItem: 'npm', commands: ['start'] };
            const startArr = parseCommand(startCommand);

            if (startArr) {
                setServerStatus('⏳ Running Run Command...');
                const startProc = await webContainer.spawn(startArr[0], startArr.slice(1));
                setServerProc(startProc);

                startProc.output.pipeTo(new WritableStream({ write(chunk) { console.log(`[server output]: ${chunk}`); } }));

                webContainer.on('server-ready', (port, url) => {
                    setIframeUrl(url);
                    setServerStatus('▶️ Server is Running');
                });

                webContainer.on('error', (error) => {
                    console.error('❌ WebContainer error:', error);
                    setServerStatus('❌ WebContainer Error');
                });
                setServerStatus('⏳ Starting Server...');
            }
        } catch (error) {
            console.error("Error during server run:", error);
            setServerStatus('❌ An error occurred');
            toast.error(`An unexpected error occurred: ${error.message}`);
        }
    };


    function writeAiMessage(message) {
        const messageObject = typeof message === "string" ? JSON.parse(message) : message;
        return (<div className='overflow-auto bg-slate-950 text-white rounded-sm p-2'><Markdown options={{ overrides: { code: SyntaxHighLightedCode } }}>{messageObject.text || ''}</Markdown></div>);
    };

    function deleteFile(filename) {
        if (!fileTree[filename]) return;
        const { [filename]: _, ...updatedTree } = fileTree;
        setFileTree(updatedTree);

        const updatedOpenFiles = openFiles.filter(f => f !== filename);
        setOpenFiles(updatedOpenFiles);

        if (currentFile === filename) {
            setCurrentFile(updatedOpenFiles[0] || null);
        }
    }


    // --- Effects ---

    useEffect(() => {
        axios.get(`/projects/get-project/${project._id}`).then(res => {
            const loadedProject = res.data.project;
            setProject(loadedProject);
            if (loadedProject.fileTree && Object.keys(loadedProject.fileTree).length > 0) setFileTree(loadedProject.fileTree);
            if (loadedProject.messages && loadedProject.messages.length > 0) setMessages(loadedProject.messages);
        });
        axios.get('/users/all').then(res => setUsers(res.data.users));

        setServerStatus('🛠️ Initialising WebContainer...');
        getWebContainer()
            .then(instance => {
                setWebContainer(instance);
                setServerStatus('✅ WebContainer initialised successfully');
                setIsWebContainerReady(true);
            })
            .catch(err => {
                console.error(err);
                setServerStatus('❌ Error initialising WebContainer');
            });
    }, [project._id]);

    useEffect(() => {
        if (!user || !project._id) return;
        const socket = initializeSocket(project._id);

        const handleNewMessage = (data) => {
            // The `data` object from the server is the complete and correct message.
            // We add it directly to our state without changing it.
            appendIncomingMessage(data);

            // Check for a fileTree within the message content
            const messageContent = data.message || {};
            if (messageContent.fileTree && Object.keys(messageContent.fileTree).length > 0) {
                setFileTree(prev => ({ ...prev, ...messageContent.fileTree }));
            }
        };

        const handleStopTyping = ({ email }) => {
            if (!email) return;
            if (typingTimeouts.current[email]) {
                clearTimeout(typingTimeouts.current[email]);
            }
            setTypingUsers(prev => {
                const newTypingUsers = { ...prev };
                delete newTypingUsers[email];
                return newTypingUsers;
            });
        };

        const handleTyping = ({ email }) => {
            if (!email) return;

            if (typingTimeouts.current[email]) {
                clearTimeout(typingTimeouts.current[email]);
            }

            setTypingUsers(prev => ({ ...prev, [email]: true }));

            typingTimeouts.current[email] = setTimeout(() => {
                handleStopTyping({ email });
            }, 3000);
        };

        // Listening for the active users update event
        const handleActiveUsersUpdate = (users) => {
            setActiveUsers(users);
        };

        const handleMessagesDeleted = ({ messageIds }) => {
            if (messageIds && messageIds.length > 0) {
                setMessages(prev => prev.filter(msg => !messageIds.includes(msg._id)));
            }
        };

        const cleanupMsg = receiveMessage('project-message', handleNewMessage);
        const cleanupTyping = receiveMessage('typing', handleTyping);
        const cleanupStopTyping = receiveMessage('stop typing', handleStopTyping);
        const cleanupActiveUsers = receiveMessage('update-active-users', handleActiveUsersUpdate);
        const cleanupDelete = receiveMessage('messages-deleted', handleMessagesDeleted);

        return () => {
            cleanupMsg();
            cleanupTyping();
            cleanupStopTyping();
            cleanupActiveUsers();
            cleanupDelete();
            socket.disconnect();
        };
    }, [user, project._id]);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        setSaveStatus('dirty');
        autoSaveProject(fileTree, messages, project);
    }, [fileTree, messages, project, autoSaveProject]);

    useEffect(() => {
        const handleBeforeUnload = (event) => {
            if (saveStatus === 'dirty') { event.preventDefault(); event.returnValue = ''; }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [saveStatus]);

    useEffect(() => { scrollToBottom(); }, [messages, typingUsers]);

    const scrollToBottom = () => { if (messageBox.current) { messageBox.current.scrollTop = messageBox.current.scrollHeight; } };
    const appendIncomingMessage = (msg) => { setMessages(prev => [...prev, msg]); };
    const appendOutgoingMessage = (msg) => { setMessages(prev => [...prev, { user, message: msg, timestamp: new Date() }]); };

    const renderTypingMessage = () => {
        const typists = Object.keys(typingUsers);
        if (typists.length === 0) return null;

        if (typists.length === 1) {
            return `${typists[0]} is typing...`;
        }
        if (typists.length === 2) {
            return `${typists[0]} and ${typists[1]} are typing...`;
        }
        return 'Several people are typing...';
    };

    const styles = {
        modalBackdrop: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
        modalContent: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '90%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' },
        modalHeader: { margin: 0, marginBottom: '15px' },
        messagesList: { overflowY: 'auto', border: '1px solid #ccc', padding: '10px', flexGrow: 1 },
        messageItem: { display: 'flex', alignItems: 'center', marginBottom: '8px' },
        messageLabel: { marginLeft: '10px' },
        modalActions: { marginTop: '20px', display: 'flex', justifyContent: 'flex-end' },
        buttonPrimary: { padding: '10px 20px', border: 'none', borderRadius: '5px', backgroundColor: '#28a745', color: 'white', cursor: 'pointer' },
        buttonSecondary: { padding: '10px 20px', border: 'none', borderRadius: '5px', backgroundColor: '#6c757d', color: 'white', cursor: 'pointer', marginLeft: '10px' }
    };

    const renderSaveStatus = () => {
        switch (saveStatus) {
            case 'saving':
                return <span style={{ color: 'white' }}>⏳ Saving...</span>;
            case 'saved':
                return <span style={{ color: 'white' }}>✅ All changes saved</span>;
            case 'dirty':
                return <span style={{ color: 'white' }}>⚠️ Unsaved changes...</span>;
            default:
                return null;
        }
    };


    return (
        <div className='w-screen h-screen flex flex-col bg-gray-700'>
            <div className="statusBar">
                <span className="font-semibold">{project.name}</span>
                <div className='flex items-center gap-4'>
                    {serverStatus && <span className='text-white text-sm'>{serverStatus}</span>}
                    {renderSaveStatus()}
                </div>
            </div>
            <main className='h-full w-full flex overflow-hidden'>
                <section className='left relative flex flex-col h-full min-w-96 bg-slate-300'>
                    <header className='flex justify-between items-center p-2 px-4 w-full bg-slate-100 h-14 shrink-0'>
                        <button className='flex gap-2 cursor-pointer' onClick={() => setIsModalOpen(true)}>
                            <i className="ri-user-add-line mr-1"></i>
                            <p>Add Collaborator</p>
                        </button>
                        <div>
                            <button onClick={() => setIsDeleteModalOpen(true)} className='p-2 cursor-pointer' title="Manage Saved Messages">
                                <i className="ri-chat-delete-line"></i>
                            </button>
                            <button onClick={() => setisSidePanelOpen(!isSidePanelOpen)} className='p-2 cursor-pointer'>
                                <i className="ri-group-fill"></i>
                            </button>
                        </div>
                    </header>

                    <div ref={messageBox} className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 bg-slate-300">
                        {messages.map((msg, idx) => (
                            <div key={msg._id || idx} className={`message flex flex-col p-2 w-fit rounded-md
                                ${msg.user?.id === 'ai' ? 'max-w-96 bg-slate-950 text-white' : msg.user?._id === user?._id ? 'ml-auto max-w-52 bg-slate-50' : 'max-w-54 bg-slate-50'}`}>
                                <small className='opacity-65 text-xs'>{msg.user?.email}</small>
                                <div className='text-sm break-words'>
                                    {msg.user?.id === 'ai' ? writeAiMessage(msg.message) : msg.message.text}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="typing-indicator-wrapper">
                        {Object.keys(typingUsers).length > 0 && (
                            <div className="typing-bubble">
                                {renderTypingMessage()}
                            </div>
                        )}
                    </div>

                    <div className="input-field w-full flex bg-white shrink-0">
                        <input value={message} onChange={handleInputChange} onKeyDown={(e) => e.key === 'Enter' && send()} className='px-4 p-2 border-none outline-none grow' type="text" placeholder='Add @ai in message to use AI Assistant' />
                        <button onClick={send} className='px-5 bg-slate-950 text-white'><i className="ri-send-plane-fill"></i></button>
                    </div>

                    <div className={`sidepanel w-full h-full flex flex-col gap-2 bg-slate-50 absolute transition-all ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'} top-0`}>
                        <header className='flex justify-between items-center p-2 px-3 bg-slate-200'>
                            <h1 className='font-semibold text-lg'>Collaborators</h1>
                            <button className='p-2 cursor-pointer' onClick={() => setisSidePanelOpen(!isSidePanelOpen)}><i className='ri-close-fill'></i></button>
                        </header>
                        {/* Conditionally rendering the green dot */}
                        <div className="users flex flex-col gap-2 p-2">
                            {project.users && project.users.map(u => (
                                <div className='user cursor-pointer hover:bg-slate-200 p-2 rounded-md flex justify-between items-center' key={u._id}>
                                    <div className="flex gap-2 items-center">
                                        <div className='aspect-square rounded-full w-fit h-fit flex items-center justify-center p-5 text-white bg-slate-600'><i className='ri-user-fill absolute'></i></div>
                                        <h1 className='font-semibold text-lg'>{u.email}</h1>
                                    </div>
                                    {/* Checking if the user's email is in the activeUsers list */}
                                    {activeUsers.includes(u.email) && (
                                        <span className="w-3 h-3 bg-green-500 rounded-full" title="Online"></span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
                <section className="right bg-slate-100 grow h-full flex">
                    <div className="explorer h-full max-w-64 bg-slate-200 min-w-52 flex flex-col">
                        <div className="p-2 bg-slate-300">
                            <button
                                onClick={() => {
                                    const fileName = prompt("Enter new file name (e.g., newfile.js)");
                                    if (!fileName) return;
                                    if (fileTree[fileName]) { toast.info("File already exists!"); return; }
                                    const updatedTree = { ...fileTree, [fileName]: { file: { contents: '' } } };
                                    setFileTree(updatedTree);
                                    setCurrentFile(fileName);
                                    setOpenFiles([...new Set([...openFiles, fileName])]);
                                }}
                                className="w-full bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded"
                            >
                                + New File
                            </button>
                        </div>
                        <div className="file-tree w-full overflow-y-auto">
                            {Object.keys(fileTree).map((file, index) => (
                                <button key={index} onClick={() => { setCurrentFile(file); setOpenFiles([...new Set([...openFiles, file])]); }} className="tree-element cursor-pointer p-2 px-4 flex items-center gap-2 bg-slate-200 w-full" >
                                    <p className="font-semibold text-lg">{file}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="editor-and-preview flex-1 flex flex-col h-full overflow-hidden">
                        <div className="code-editor flex flex-col grow h-full">
                            <div className='top flex justify-between items-center w-full bg-slate-200'>
                                <div className="files flex">
                                    {openFiles.map((file, index) => (
                                        <button key={index} onClick={() => setCurrentFile(file)} className={`open-file cursor-pointer p-2 px-4 flex items-center w-fit gap-2 bg-slate-300 ${currentFile === file ? 'bg-slate-50' : ''}`} >
                                            <p className='font-semibold text-lg'>{file}</p>
                                            <i className="ri-delete-bin-fill text-red-500 hover:text-red-700 ml-2" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Are you sure you want to delete "${file}"?`)) { deleteFile(file); } }} />
                                        </button>
                                    ))}
                                </div>
                                <div className="actions p-2">
                                    <button onClick={() => setIsSaveModalOpen(true)} className='p-2 px-4 bg-green-600 text-white rounded mr-2'>Save</button>
                                    <button onClick={handleStopServer} disabled={!isWebContainerReady} className='p-2 px-4 bg-red-600 text-white rounded mr-2 disabled:bg-red-400 disabled:cursor-not-allowed'>Stop</button>
                                    <button
                                        onClick={handleRunServer}
                                        disabled={!isWebContainerReady}
                                        className='p-2 px-4 bg-blue-500 text-white rounded disabled:bg-blue-300 disabled:cursor-not-allowed'>
                                        Run
                                    </button>
                                </div>
                            </div>
                            <div className='bottom flex grow max-w-full shrink overflow-auto'>
                                {fileTree[currentFile] ? (
                                    <div className='code-editor-area h-full w-full overflow-auto grow bg-slate-50'>
                                        <pre className='hljs h-full'>
                                            <code
                                                className='hljs h-full outline-none p-4'
                                                contentEditable={true}
                                                suppressContentEditableWarning={true}
                                                onBlur={(e) => {
                                                    const updatedContent = e.target.textContent;
                                                    const ft = { ...fileTree, [currentFile]: { file: { contents: updatedContent } } };
                                                    setFileTree(ft);
                                                }}
                                                dangerouslySetInnerHTML={{ __html: hljs.highlight(fileTree[currentFile]?.file?.contents || '', { language: getLanguage(currentFile) }).value }}
                                                style={{ whiteSpace: 'pre-wrap', paddingBottom: '25rem' }}
                                            />
                                        </pre>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full bg-slate-50 text-gray-500">
                                        <p>Select a file to start editing or create a new one</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        {iframeUrl && webContainer && (
                            <div className="flex flex-col min-w-[50%] h-full border-l-2 border-gray-400">
                                <div className="address-bar">
                                    <input onChange={(e) => setIframeUrl(e.target.value)} type='text' value={iframeUrl} className='w-full p-2 px-4 bg-slate-200' />
                                </div>
                                <iframe src={iframeUrl} className='w-full h-full'></iframe>
                            </div>
                        )}
                    </div>
                </section>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                        <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 sm:mx-0 p-6 flex flex-col gap-4">
                            <header className="flex justify-between items-center mb-2">
                                <h2 className="text-xl font-bold">Select a User</h2>
                                <button className="text-gray-500 hover:text-gray-700" onClick={() => setIsModalOpen(false)}>
                                    <i className="ri-close-line text-2xl"></i>
                                </button>
                            </header>
                            <div className="users-list flex flex-col items-center gap-2 max-h-72 overflow-y-auto">
                                {users.map(u => (
                                    <button key={u._id} className={`user cursor-pointer flex items-center hover:bg-slate-100 ${Array.from(selectedUserId).includes(u._id) ? 'bg-slate-200 text-black' : ''} gap-3 p-3 rounded-lg transition-colors w-full text-left`} onClick={() => handleUserSelect(u._id)}>
                                        <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white">
                                            <i className="ri-user-3-line text-lg"></i>
                                        </div>
                                        <div>
                                            <div className="font-semibold">{u.name}</div>
                                            <div className="text-xs text-gray-500">{u.email}</div>
                                        </div>
                                    </button>
                                ))}
                                <button onClick={addcollaborators} className='bg-slate-950 text-white px-4 py-2 rounded-lg mt-4'>Add Selected</button>
                            </div>
                        </div>
                    </div>
                )}
                {isSaveModalOpen && (
                    <div style={styles.modalBackdrop}>
                        <div style={styles.modalContent}>
                            <h2 style={styles.modalHeader}>Select Messages to Save</h2>
                            <div style={styles.messagesList}>
                                {messages.map((msg, index) => (
                                    <div key={msg._id || index} style={styles.messageItem}>
                                        <input type="checkbox" id={`msg-${index}`} onChange={(e) => handleMessageSelection(msg, e.target.checked)} />
                                        <label htmlFor={`msg-${index}`} style={styles.messageLabel}>
                                            <strong>{msg.user?.email}:</strong> {msg.message?.text || JSON.stringify(msg.message)}
                                        </label>
                                    </div>
                                ))}
                            </div>
                            <div style={styles.modalActions}>
                                <button onClick={handleSaveProject} style={styles.buttonPrimary}>Save Selected</button>
                                <button onClick={() => setIsSaveModalOpen(false)} style={styles.buttonSecondary}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
                {isDeleteModalOpen && (() => {
                    // --- NEW LOGIC ---
                    // 1. Get the logged-in user's ID.
                    const loggedInUserId = user?._id;

                    // 2. Filter the messages to find only those the user can delete.
                    const deletableMessages = messages.filter(msg => {
                        // Rule 1: Must be a saved message (have an _id)
                        if (!msg._id) {
                            return false;
                        }
                        
                        // Rule 2: Must be deletable
                        const isAIMessage = !msg.user?._id; // AI message if no user._id
                        const isMyMessage = msg.user?._id === loggedInUserId;
                        
                        return isAIMessage || isMyMessage;
                    });
                    // --- END NEW LOGIC ---

                    return (
                        <div style={styles.modalBackdrop}>
                            <div style={styles.modalContent}>
                                <h2 style={styles.modalHeader}>Select Messages to Delete</h2>
                                <p style={{ color: '#6c757d', marginTop: '-10px', marginBottom: '15px' }}>Only messages you are allowed to delete are shown here.</p>
                                <div style={styles.messagesList}>
                                    {/* --- MODIFIED --- */}
                                    {/* Use the new `deletableMessages` array */}
                                    {deletableMessages.length > 0 ? (
                                        deletableMessages.map((msg, index) => (
                                            <div key={msg._id} style={styles.messageItem}>
                                                <input type="checkbox" id={`del-msg-${index}`} onChange={(e) => handleMessageDeletionSelection(msg, e.target.checked)} />
                                                <label htmlFor={`del-msg-${index}`} style={styles.messageLabel}>
                                                    {/* Updated to show "AI Assistant" for AI messages */}
                                                    <strong>{msg.user?.email || 'AI Assistant'}:</strong> {msg.message?.text || JSON.stringify(msg.message)}
                                                </label>
                                            </div>
                                        ))
                                    ) : (
                                        // Updated the "no messages" text
                                        <p>You do not have any messages that you can delete.</p>
                                    )}
                                    {/* --- END MODIFICATION --- */}
                                </div>
                                <div style={styles.modalActions}>
                                    <button onClick={handleDeleteMessages} style={{ ...styles.buttonPrimary, backgroundColor: '#dc3545' }}>Delete Selected</button>
                                    <button onClick={() => setIsDeleteModalOpen(false)} style={styles.buttonSecondary}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </main>
        </div>
    )
}

export default Project;