import React, { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from '../config/axios.js'
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket.js'
import { UserContext } from '../context/user.context'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js'
import { getWebContainer } from '../config/webContainer.js'

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

    // If mainItem is a string with spaces (shouldn't be, but just in case)
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

// Helper to get language from filename for highlight.js
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
    const location = useLocation()
    const [isSidePanelOpen, setisSidePanelOpen] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState(new Set())
    const [project, setProject] = useState(location.state.project)
    const [message, setMessage] = useState('')
    const { user } = useContext(UserContext)
    const [messages, setMessages] = useState([])
    const messageBox = useRef()
    const [users, setUsers] = useState([])

    const [fileTree, setFileTree] = useState({})
    const [currentFile, setCurrentFile] = useState(null)
    const [openFiles, setOpenFiles] = useState([])

    const [webContainer, setWebContainer] = useState(null)
    const [iframeUrl, setIframeUrl] = useState(null)

    const [serverProc, setServerProc] = useState(null);

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
        sendMessage('project-message', {
            message: { text: message },
            user
        })
        appendOutgoingMessage({ text: message })
        setMessage('')
    }

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

        const updatedTree = { ...fileTree };
        delete updatedTree[filename];

        setFileTree(updatedTree);
        saveFileTree(updatedTree); // <-- Make sure this is called

        const updatedOpenFiles = openFiles.filter(f => f !== filename);
        setOpenFiles(updatedOpenFiles);

        if (currentFile === filename) {
            setCurrentFile(updatedOpenFiles[0] || null);
        }
    }

    useEffect(() => {
        initializeSocket(project._id)

        let cleanup = null;

        getWebContainer().then(container => {
            setWebContainer(container)
        })

        receiveMessage('project-message', (data) => {
            console.log(data)
            let message
            if (typeof data.message === "string") {
                try {
                    message = JSON.parse(data.message)
                } catch (e) {
                    message = { text: data.message }
                }
            } else {
                message = data.message
            }

            // If AI response includes fileTree, update and mount
            if (message.fileTree) {
                setFileTree(message.fileTree)
                if (webContainer) {
                    webContainer.mount(message.fileTree)
                }
            }

            appendIncomingMessage({ ...data, message })
        })

        axios.get(`/projects/get-project/${location.state.project._id}`).then(res => {
            setProject(res.data.project)
            setFileTree(res.data.project.fileTree)
        })
        axios.get('/users/all').then(res => {
            setUsers(res.data.users)
        }).catch(err => {
            console.error("Error fetching users:", err)
        })

        // Cleanup function for socket listeners
        return () => {
            if (cleanup) cleanup()
        }
    }, [])

    function saveFileTree(ft) {
        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: ft
        }).then(res => {
            console.log('✅ File tree saved to DB:', res.data);
        }).catch(err => {
            console.error('❌ Error saving file tree to DB:', err);
        })
    }

    function scrollToBottom() {
        if (messageBox.current) {
            messageBox.current.scrollTop = messageBox.current.scrollHeight
        }
    }

    function appendIncomingMessage(msg) {
        setMessages(prev => [...prev, msg])
    }

    function appendOutgoingMessage(msg) {
        setMessages(prev => [...prev, {
            user,
            message: msg,
            timestamp: new Date()
        }])
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    return (
        <main className='h-screen w-screen flex'>
            <section className='left relative flex flex-col h-screen min-w-96 bg-slate-300'>
                <header className='flex justify-between items-center p-2 px-4 w-full bg-slate-100 absolute top-0 z-10 h-14'>
                    <button className='flex gap-2 cursor-pointer' onClick={() => setIsModalOpen(true)}>
                        <i className="ri-user-add-line mr-1"></i>
                        <p>Add Collaborator</p>
                    </button>
                    <button onClick={() => setisSidePanelOpen(!isSidePanelOpen)} className='p-2 cursor-pointer'>
                        <i className="ri-group-fill"></i>
                    </button>
                </header>
                <div className="conversation-area pt-14 pb-10 grow flex flex-col h-full relative">
                    <div ref={messageBox} className="message-box p-1 grow flex flex-col bg-slate-300 gap-1 overflow-auto max-h-full">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`message flex flex-col p-2 w-fit rounded-md
                ${msg.user?.id === 'ai'
                                    ? 'max-w-96 bg-slate-950 text-white'
                                    : msg.user?._id === user._id
                                        ? 'ml-auto max-w-52 bg-slate-50'
                                        : 'max-w-54 bg-slate-50'
                                }`}>
                                <small className='opacity-65 text-xs'>{msg.user?.email}</small>
                                <div className='text-sm'>
                                    {msg.user?.id === 'ai'
                                        ? writeAiMessage(msg.message)
                                        : msg.message?.text || msg.message}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="input-field w-full flex absolute bottom-0 bg-white">
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
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
                        {project.users && project.users.map(user => (
                            <div className='user cursor-pointer hover:bg-slate-200 p-2 flex gap-2 items-center' key={user._id}>
                                <div className='aspect-square rounded-full w-fit h-fit flex items-center justify-center p-5 text-white bg-slate-600'>
                                    <i className='ri-user-fill absolute'></i>
                                </div>
                                <h1 className='font-semibold text-lg'>{user.email}</h1>
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

                                if (fileTree[fileName]) {
                                    alert("File already exists!");
                                    return;
                                }

                                const updatedTree = {
                                    ...fileTree,
                                    [fileName]: { file: { contents: '' } }
                                };

                                setFileTree(updatedTree);
                                saveFileTree(updatedTree);
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
                            <button
                                key={index}
                                onClick={() => {
                                    setCurrentFile(file);
                                    setOpenFiles([...new Set([...openFiles, file])]);
                                }}
                                className="tree-element cursor-pointer p-2 px-4 flex items-center gap-2 bg-slate-200 w-full"
                            >
                                <p className="font-semibold text-lg">{file}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="code-editor flex flex-col grow h-full shrink">
                    <div className='top flex justify-between w-full'>
                        <div className="files flex">
                            {
                                openFiles.map((file, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentFile(file)}
                                        className={`open-file cursor-pointer p-2 px-4 flex items-center w-fit gap-2 bg-slate-300 ${currentFile === file ? 'bg-slate-400' : ''}`}
                                    >
                                        <p className='font-semibold text-lg'>{file}</p>
                                        <i
                                            className="ri-delete-bin-fill text-red-500 hover:text-red-700 ml-2"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`Are you sure you want to delete "${file}"?`)) {
                                                    deleteFile(file); // 🔁 correct usage
                                                }
                                            }}
                                        />
                                    </button>
                                ))
                            }
                        </div>

                        <div className="actions">
                            <button
                                onClick={async () => {
                                    if (!webContainer) return;
                                    await webContainer.mount(fileTree);

                                    // Find the last AI message with buildCommand and startCommand
                                    const aiMsg = messages
                                        .filter(msg => msg.user?.id === 'ai' && (msg.message?.buildCommand || msg.message?.startCommand))
                                        .map(msg => msg.message)
                                        .pop();

                                    // Run build command (npm install) if present
                                    if (aiMsg?.buildCommand) {
                                        const buildArr = parseCommand(aiMsg.buildCommand);
                                        if (buildArr) {
                                            const buildProc = await webContainer.spawn(buildArr[0], buildArr.slice(1));
                                            await buildProc.exit; // Wait for install to finish
                                        }
                                    }

                                    // Kill previous server if running
                                    if (serverProc) {
                                        try {
                                            await serverProc.kill();
                                        } catch (e) {
                                            console.warn("Failed to kill previous server:", e);
                                        }
                                    }

                                    // Run start command
                                    let startArr = parseCommand(aiMsg?.startCommand);
                                    if (!startArr) startArr = ['npm', 'start'];
                                    const startProc = await webContainer.spawn(startArr[0], startArr.slice(1));
                                    setServerProc(startProc); // Save reference to kill next time

                                    startProc.output.pipeTo(new WritableStream({
                                        write(chunk) {
                                            console.log(chunk);
                                        }
                                    }));

                                    webContainer.on('server-ready', (port, url) => {
                                        console.log(url)
                                        setIframeUrl(url)
                                    })
                                }}
                                className='p-2 px-4 bg-blue-500 text-white'>
                                Run
                            </button>


                        </div>
                    </div>
                    <div className='bottom flex grow max-w-full shrink overflow-auto'>
                        {
                            fileTree[currentFile] && (
                                <div className='code-editor-area h-full overflow-auto grow bg-slate-50'>
                                    <pre className='hljs h-full'>
                                        <code
                                            className='hljs h-full outline-none'
                                            contentEditable={true}
                                            suppressContentEditableWarning={true}
                                            onBlur={(e) => {
                                                const updatedContent = e.target.textContent
                                                const ft = {
                                                    ...fileTree,
                                                    [currentFile]: {
                                                        file: {
                                                            contents: updatedContent
                                                        }
                                                    }
                                                }
                                                setFileTree(ft)
                                                saveFileTree(ft)
                                            }}

                                            dangerouslySetInnerHTML={{
                                                __html: hljs.highlight(fileTree[currentFile].file.contents || '', {
                                                    language: getLanguage(currentFile)
                                                }).value

                                            }}
                                            style={{
                                                whiteSpace: 'pre-wrap',
                                                paddingBottom: '25rem',
                                                counterSet: 'line-numbering',
                                            }}
                                        />
                                    </pre>
                                </div>
                            )
                        }
                    </div>
                </div>

                {iframeUrl && webContainer &&
                    (<div className="flex flex-col min-w-96 h-full">
                        <div className="address-bar">
                            <input
                                onChange={(e) => setIframeUrl(e.target.value)}
                                type='text' value={iframeUrl} className='w-full p-2 px-4 bg-slate-200' />
                        </div>
                        <iframe src={iframeUrl} className='w-full h-full'></iframe>
                    </div>)
                }

            </section>
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 sm:mx-0 p-6 flex flex-col gap-4">
                        <header className="flex justify-between items-center mb-2">
                            <h2 className="text-xl font-bold">Select a User</h2>
                            <button
                                className="text-gray-500 hover:text-gray-700"
                                onClick={() => setIsModalOpen(false)}
                            >
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </header>
                        <div className="users-list flex flex-col items-center gap-2 max-h-72 overflow-y-auto">
                            {users.map(user => (
                                <button
                                    key={user._id}
                                    className={`user cursor-pointer flex items-center hover:bg-slate-100 ${Array.from(selectedUserId).indexOf(user._id) !== -1 ? 'bg-slate-200 text-black' : ''} gap-3 p-3 rounded-lg transition-colors w-full text-left`}
                                    onClick={() => handleUserSelect(user._id)}
                                >
                                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white">
                                        <i className="ri-user-3-line text-lg"></i>
                                    </div>
                                    <div className='users-list flex flex-col gap-2 max-h-96 overflow-y-auto'>
                                        <div className="font-semibold">{user.name}</div>
                                        <div className="text-xs text-gray-500">{user.email}</div>
                                    </div>
                                </button>
                            ))}
                            <button
                                onClick={addcollaborators}
                                className='bg-slate-950 text-white px-4 py-2 rounded-lg mt-4'>
                                Add Selected
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Project
