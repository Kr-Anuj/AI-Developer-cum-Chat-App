import React, { useContext, useState, useEffect } from 'react'
import { UserContext } from '../context/user.context'
import axios from "../config/axios"
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify';

const Home = () => {
    const { user, setUser } = useContext(UserContext)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [projectName, setProjectName] = useState('')
    const [projects, setProjects] = useState([])
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate()

    // Function to handle user logout
    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        navigate('/login');
        toast.success("You have been logged out.");
    };

    function createProject(e) {
        e.preventDefault()
        axios.post('/projects/create', {
            name: projectName,
        })
        .then((res) => {
            setProjects(prevProjects => [...prevProjects, res.data]);
            setIsModalOpen(false)
            setProjectName('');
            toast.success(`Project "${res.data.name}" created!`);
        })
        .catch((error) => {
            toast.error(error.response?.data || "Failed to create project.");
        })
    }

    useEffect(() => {
        setIsLoading(true);
        axios.get('/projects/all').then((res) => {
            setProjects(res.data.projects)
        }).catch(err => {
            console.log(err)
            toast.error("Could not load projects.");
        }).finally(() => {
            setIsLoading(false);
        });
    }, [])

    const renderProjects = () => {
        if (isLoading) {
            return <p className="text-gray-500">Loading projects...</p>;
        }

        if (projects.length === 0) {
            return (
                <div className="text-center p-8 border-2 border-dashed rounded-lg col-span-full">
                    <h2 className="text-xl font-semibold mb-2">No Projects Found</h2>
                    <p className="mb-4">Get started by creating your first project.</p>
                </div>
            );
        }

        return (
            <>
                {projects.map((project) => (
                    <div key={project._id}
                        onClick={() => {
                            navigate(`/project`, {
                                state: { project }
                            })
                        }}
                        className="project flex flex-col gap-2 cursor-pointer p-4 border border-slate-300 rounded-md min-w-52 hover:bg-slate-200 transition-colors">
                        <h2 className='font-semibold'>{project.name}</h2>
                        <div className="flex gap-2 items-center text-gray-600">
                            <i className="ri-user-line"></i>
                            <small>Collaborators: {project.users.length}</small>
                        </div>
                    </div>
                ))}
            </>
        );
    }

    return (
        <main className='p-4 relative min-h-screen bg-gray-50'>
            
            {/* Logout button */}
            <button
                onClick={handleLogout}
                className="absolute top-4 right-4 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors"
            >
                Logout
            </button>

            <div className="projects flex flex-wrap gap-3">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="project p-4 border border-slate-300 rounded-md hover:bg-slate-100 transition-colors">
                    + New Project
                </button>
                {renderProjects()}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white p-6 rounded-md shadow-md w-full max-w-md mx-4">
                        <h2 className="text-xl mb-4">Create New Project</h2>
                        <form onSubmit={createProject}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700">Project Name</label>
                                <input
                                    onChange={(e) => setProjectName(e.target.value)}
                                    value={projectName}
                                    type="text" className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required />
                            </div>
                            <div className="flex justify-end">
                                <button type="button" className="mr-2 px-4 py-2 bg-gray-300 rounded-md" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Home;