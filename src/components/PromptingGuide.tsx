'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

export default function PromptingGuide() {
    const [config, setConfig] = useState<any[]>([]);
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [activeContent, setActiveContent] = useState<string>('');
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);
    const [isLoadingContent, setIsLoadingContent] = useState(false);

    // Fetch configuration on component mount
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await fetch('/guide-config.json');
                const jsonConfig = await response.json();
                setConfig(jsonConfig);
                // Set the first file in the config as active by default
                if (jsonConfig.length > 0) {
                    const firstItem = jsonConfig[0];
                    if (firstItem.file) {
                        setActiveFile(firstItem.file);
                    } else if (firstItem.children && firstItem.children.length > 0) {
                        setActiveFile(firstItem.children[0].file);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch config:', error);
            } finally {
                setIsLoadingConfig(false);
            }
        };
        fetchConfig();
    }, []);

    // Fetch content when activeFile changes
    useEffect(() => {
        const fetchContent = async () => {
            if (!activeFile) return;
            setIsLoadingContent(true);
            try {
                const response = await fetch(`/${activeFile}`); // Fetch from public directory
                const markdownText = await response.text();
                setActiveContent(markdownText);
            } catch (error) {
                console.error('Failed to fetch content:', error);
                setActiveContent('Error loading content.');
            } finally {
                setIsLoadingContent(false);
            }
        };
        fetchContent();
    }, [activeFile]);

    const renderTree = (nodes: any[]) => (
        <ul>
            {nodes.map((node, index) => (
                <li key={index}>
                    {node.file ? (
                        <button
                            onClick={() => setActiveFile(node.file)}
                            className={`block w-full text-left p-2 rounded-md ${activeFile === node.file ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                            {node.title_zh} / {node.title_en}
                        </button>
                    ) : (
                        <span className="block p-2 font-semibold text-gray-800">
                            {node.title_zh} / {node.title_en}
                        </span>
                    )}
                    {node.children && <ul className="pl-4">{renderTree(node.children)}</ul>}
                </li>
            ))}
        </ul>
    );

    return (
        <div className="flex h-full bg-white">
            {/* Left Sidebar for Navigation Tree */}
            <aside className="w-64 p-4 border-r border-gray-200 overflow-y-auto">
                <h2 className="text-lg font-semibold mb-4">练功指南目录</h2>
                {isLoadingConfig ? (
                    <div className="text-gray-500">Loading menu...</div>
                ) : (
                    renderTree(config)
                )}
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 p-8 overflow-y-auto">
                {isLoadingContent ? (
                    <div className="text-center text-gray-500">Loading content...</div>
                ) : (
                    <div className="prose max-w-none"> {/* Use prose for markdown styling */}
                        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{activeContent}</ReactMarkdown>
                    </div>
                )}
            </main>
        </div>
    );
}
