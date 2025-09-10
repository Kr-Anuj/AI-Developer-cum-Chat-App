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

    // UI State
    const [isSidePanelOpen, setisSidePanelOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // State for selections in modals
    const [selectedUserId, setSelectedUserId] = useState(new Set());
    const [selectedMessages, setSelectedMessages] = useState(new Set());
    const [messagesToDelete, setMessagesToDelete] = useState(new Set());

    // WebContainer State
    const [webContainer, setWebContainer] = useState(null);
    const [iframeUrl, setIframeUrl] = useState(null);
    const [serverProc, setServerProc] = useState(null);

    // Refs
    const messageBox = useRef();
    const isInitialMount = useRef(true);

    // --- Handlers ---

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

    function send() {
        if (!message.trim()) return;
        sendMessage('project-message', {
            message: { text: message },
            user
        });
        appendOutgoingMessage({ text: message });
        setMessage('');
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
            await axios.patch(`/projects/${project._id}/save`, payload);
            toast.success("Project saved successfully!");
            setIsSaveModalOpen(false);
            setIsDirty(false);
        } catch (error) {
            console.error("Failed to save project:", error);
            toast.error("Error saving project.");
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
                setMessages(prev => prev.filter(msg => !messageIds.includes(msg._id)));
                toast.success("Messages deleted successfully.");
                setIsDeleteModalOpen(false);
            } catch (error) {
                console.error("Failed to delete messages:", error);
                toast.error("Error deleting messages.");
            }
        }
    };

    function writeAiMessage(message) {
        const messageObject = typeof message === "string" ? JSON.parse(message) : message
        return (
            <div className='overflow-auto bg-slate-950 text-white rounded-sm p-2'>
                <Markdown
                    children={messageObject.text}
                    options={{
                        overrides: { code: SyntaxHighLightedCode },
                    }}
                />
            </div>
        )
    }

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

    // Debounced auto-save function
    const autoSaveProject = useRef(
        debounce((latestFileTree, latestMessages) => {
            console.log("Auto-saving project...");
            const payload = {
                fileTree: latestFileTree,
                selectedMessages: latestMessages // Save all current messages
            };
            // Using the project._id directly from state
            axios.patch(`/projects/${project._id}/save`, payload)
                .then(() => console.log("✅ Project auto-saved."))
                .catch(err => console.error("Auto-save failed:", err));
        }, 6000) // 6000ms = 6 second delay
    ).current;

    const handleStopServer = async () => {
        if (serverProc) {
            console.log("Stopping server process...");
            try {
                await serverProc.kill();
                setServerProc(null); // Clear the process from state
                setIframeUrl(null); // Clear the iframe
                toast.success("Server stopped successfully.");
            } catch (e) {
                console.warn("Failed to stop server:", e);
                toast.error("Failed to stop the server.");
            }
        } else {
            toast.info("No server is currently running.");
        }
    };

    // --- Effects ---

    useEffect(() => {
        axios.get(`/projects/get-project/${project._id}`).then(res => {
            const loadedProject = res.data.project;
            setProject(loadedProject);
            if (loadedProject.fileTree && Object.keys(loadedProject.fileTree).length > 0) setFileTree(loadedProject.fileTree);
            if (loadedProject.messages && loadedProject.messages.length > 0) setMessages(loadedProject.messages);
        });
        axios.get('/users/all').then(res => setUsers(res.data.users));
        getWebContainer().then(setWebContainer);
    }, [project._id]);

    useEffect(() => {
        if (!user || !project._id) return;
        const socket = initializeSocket(project._id);
        const handleNewMessage = (data) => {
            if (data.user?.email === user.email && data.user?.id !== 'ai') return;
            let message;
            try {
                message = typeof data.message === "string" ? JSON.parse(data.message) : data.message;
            } catch (e) { message = { text: data.message }; }
            appendIncomingMessage({ ...data, message });
            if (message.fileTree && Object.keys(message.fileTree).length > 0) {
                setFileTree(prev => ({ ...prev, ...message.fileTree }));
            }
        };
        const cleanup = receiveMessage('project-message', handleNewMessage);
        return () => {
            if (typeof cleanup === 'function') cleanup();
            socket.disconnect();
        };
    }, [user, project._id]);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
        } else {
            setIsDirty(true);
        }
    }, [fileTree, messages]);

    useEffect(() => {
        const handleBeforeUnload = (event) => {
            if (isDirty) {
                event.preventDefault();
                event.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // UseEffect to trigger the auto-save
    useEffect(() => {
        // Don't auto-save on the initial load
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        // Calling the debounced function with the latest state
        autoSaveProject(fileTree, messages);

    }, [fileTree, messages, autoSaveProject]); // This effect runs when data changes

    function scrollToBottom() {
        if (messageBox.current) {
            messageBox.current.scrollTop = messageBox.current.scrollHeight;
        }
    }
    function appendIncomingMessage(msg) { setMessages(prev => [...prev, msg]); }
    function appendOutgoingMessage(msg) { setMessages(prev => [...prev, { user, message: msg, timestamp: new Date() }]); }

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

    return (
        <main className='h-screen w-screen flex'>
            <section className='left relative flex flex-col h-screen min-w-96 bg-slate-300'>
                <header className='flex justify-between items-center p-2 px-4 w-full bg-slate-100 absolute top-0 z-10 h-14'>
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
                <div className="conversation-area pt-14 pb-10 grow flex flex-col h-full relative">
                    <div ref={messageBox} className="message-box p-1 grow flex flex-col bg-slate-300 gap-1 overflow-auto max-h-full">
                        {messages.map((msg, idx) => (
                            <div key={msg._id || idx} className={`message flex flex-col p-2 w-fit rounded-md
                                ${msg.user?.id === 'ai' ? 'max-w-96 bg-slate-950 text-white' : msg.user?._id === user._id ? 'ml-auto max-w-52 bg-slate-50' : 'max-w-54 bg-slate-50'}`}>
                                <small className='opacity-65 text-xs'>{msg.user?.email}</small>
                                <div className='text-sm'>
                                    {msg.user?.id === 'ai' ? writeAiMessage(msg.message) : msg.message.text}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="input-field w-full flex absolute bottom-0 bg-white">
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && send()}
                            className='px-4 p-2 border-none outline-none grow'
                            type="text"
                            placeholder='Write your message here' />
                        <button onClick={send} className='px-5 bg-slate-950 text-white'>
                            <i className="ri-send-plane-fill"></i>
                        </button>
                    </div>
                </div>
                <div className={`sidepanel w-full h-full flex flex-col gap-2 bg-slate-50 absolute transition-all ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'} top-0`}>
                    <header className='flex justify-between items-center p-2 px-3 bg-slate-200'>
                        <h1 className='font-semibold text-lg'>Collaborators</h1>
                        <button className='p-2 cursor-pointer' onClick={() => setisSidePanelOpen(!isSidePanelOpen)}>
                            <i className='ri-close-fill'></i>
                        </button>
                    </header>
                    <div className="users flex flex-col gap-2">
                        {project.users && project.users.map(u => (
                            <div className='user cursor-pointer hover:bg-slate-200 p-2 flex gap-2 items-center' key={u._id}>
                                <div className='aspect-square rounded-full w-fit h-fit flex items-center justify-center p-5 text-white bg-slate-600'>
                                    <i className='ri-user-fill absolute'></i>
                                </div>
                                <h1 className='font-semibold text-lg'>{u.email}</h1>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            <section className="right bg-red-50 grow h-full flex">
                <div className="explorer h-full max-w-64 bg-slate-400 min-w-52 flex flex-col">
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
                    <div className="file-tree w-full">
                        {Object.keys(fileTree).map((file, index) => (
                            <button key={index} onClick={() => { setCurrentFile(file); setOpenFiles([...new Set([...openFiles, file])]); }} className="tree-element cursor-pointer p-2 px-4 flex items-center gap-2 bg-slate-200 w-full" >
                                <p className="font-semibold text-lg">{file}</p>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="code-editor flex flex-col grow h-full shrink">
                    <div className='top flex justify-between w-full'>
                        <div className="files flex">
                            {openFiles.map((file, index) => (
                                <button key={index} onClick={() => setCurrentFile(file)} className={`open-file cursor-pointer p-2 px-4 flex items-center w-fit gap-2 bg-slate-300 ${currentFile === file ? 'bg-slate-400' : ''}`} >
                                    <p className='font-semibold text-lg'>{file}</p>
                                    <i className="ri-delete-bin-fill text-red-500 hover:text-red-700 ml-2" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Are you sure you want to delete "${file}"?`)) { deleteFile(file); } }} />
                                </button>
                            ))}
                        </div>
                        <div className="actions">
                            <button onClick={() => setIsSaveModalOpen(true)} className='p-2 px-4 bg-green-600 text-white mr-2'>
                                Save Project
                            </button>

                            {/* STOP BUTTON */}
                            <button
                                onClick={handleStopServer}
                                className='p-2 px-4 bg-red-600 text-white mr-2'>
                                Stop
                            </button>

                            <button
                                onClick={async () => {
                                    if (!webContainer) { console.error("WebContainer not ready."); return; }
                                    await webContainer.mount(fileTree);
                                    const aiMsg = messages.slice().reverse().find(msg => msg.user?.id === 'ai' && (msg.message?.buildCommand || msg.message?.startCommand))?.message;
                                    const buildCommand = aiMsg?.buildCommand || { mainItem: 'npm', commands: ['install'] };
                                    const buildArr = parseCommand(buildCommand);
                                    if (buildArr) {
                                        const buildProc = await webContainer.spawn(buildArr[0], buildArr.slice(1));
                                        buildProc.output.pipeTo(new WritableStream({ write(chunk) { console.log(`[npm install]: ${chunk}`); } }));
                                        const exitCode = await buildProc.exit;
                                        if (exitCode !== 0) { console.error(`❌ Build process failed with exit code ${exitCode}.`); return; }
                                    }
                                    if (serverProc) { try { await serverProc.kill(); } catch (e) { console.warn("Failed to kill previous server:", e); } }
                                    const startCommand = aiMsg?.startCommand || { mainItem: 'npm', commands: ['start'] };
                                    const startArr = parseCommand(startCommand);
                                    if (startArr) {
                                        const startProc = await webContainer.spawn(startArr[0], startArr.slice(1));
                                        setServerProc(startProc);
                                        startProc.output.pipeTo(new WritableStream({ write(chunk) { console.log(`[server output]: ${chunk}`); } }));
                                        webContainer.on('server-ready', (port, url) => setIframeUrl(url));
                                        webContainer.on('error', (error) => console.error('❌ WebContainer error:', error));
                                    }
                                }}
                                className='p-2 px-4 bg-blue-500 text-white'>
                                Run
                            </button>
                        </div>
                    </div>
                    <div className='bottom flex grow max-w-full shrink overflow-auto'>
                        {fileTree[currentFile] && (
                            <div className='code-editor-area h-full overflow-auto grow bg-slate-50'>
                                <pre className='hljs h-full'>
                                    <code
                                        className='hljs h-full outline-none'
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
                        )}
                    </div>
                </div>
                {iframeUrl && webContainer && (
                    <div className="flex flex-col min-w-96 h-full">
                        <div className="address-bar">
                            <input onChange={(e) => setIframeUrl(e.target.value)} type='text' value={iframeUrl} className='w-full p-2 px-4 bg-slate-200' />
                        </div>
                        <iframe src={iframeUrl} className='w-full h-full'></iframe>
                    </div>
                )}
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
            {isDeleteModalOpen && (
                <div style={styles.modalBackdrop}>
                    <div style={styles.modalContent}>
                        <h2 style={styles.modalHeader}>Select Saved Messages to Delete</h2>
                        <p style={{ color: '#6c757d', marginTop: '-10px', marginBottom: '15px' }}>Only messages saved to the database are shown here.</p>
                        <div style={styles.messagesList}>
                            {messages.filter(msg => msg._id).length > 0 ? (
                                messages.filter(msg => msg._id).map((msg, index) => (
                                    <div key={msg._id} style={styles.messageItem}>
                                        <input type="checkbox" id={`del-msg-${index}`} onChange={(e) => handleMessageDeletionSelection(msg, e.target.checked)} />
                                        <label htmlFor={`del-msg-${index}`} style={styles.messageLabel}>
                                            <strong>{msg.user?.email}:</strong> {msg.message?.text || JSON.stringify(msg.message)}
                                        </label>
                                    </div>
                                ))
                            ) : (
                                <p>No messages have been saved to the database yet.</p>
                            )}
                        </div>
                        <div style={styles.modalActions}>
                            <button onClick={handleDeleteMessages} style={{ ...styles.buttonPrimary, backgroundColor: '#dc3545' }}>Delete Selected</button>
                            <button onClick={() => setIsDeleteModalOpen(false)} style={styles.buttonSecondary}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Project