'use client';

import {useState, useEffect, useRef} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as XLSX from 'xlsx';

// --- Type Definitions ---
interface Part {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

interface Message {
    role: 'user' | 'model';
    parts: Part[];
}

// --- Helper Components ---
const IconPlus = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14"/>
        <path d="M12 5v14"/>
    </svg>
);

const IconImage = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2"/>
        <circle cx="9" cy="9" r="2"/>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
    </svg>
);

const IconSend = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 2-7 20-4-9-9-4Z"/>
        <path d="M22 2 11 13"/>
    </svg>
);

const IconDownload = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" x2="12" y1="15" y2="3"/>
    </svg>
);


// --- Main Chat Component ---
export default function ChatClient() {
    // --- State Management ---
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('gemini-2.5-pro');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageData, setImageData] = useState<string | null>(null);
    const [imageMimeType, setImageMimeType] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const tempApiKeyRef = useRef('');

    // --- Effects ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
    }, [messages]);

    useEffect(() => {
        const storedApiKey = localStorage.getItem('gemini-api-key');
        const storedModel = localStorage.getItem('gemini-model');
        if (storedApiKey) {
            setApiKey(storedApiKey);
            tempApiKeyRef.current = storedApiKey;
        }
        if (storedModel) setModel(storedModel);
    }, []);

    // --- Handlers ---
    const clearImageData = () => {
        setImagePreview(null);
        setImageData(null);
        setImageMimeType(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleNewChat = () => {
        setMessages([]);
        clearImageData();
    };

    const handleExportExcel = () => {
        if (messages.length === 0) {
            alert("No chat history to export.");
            return;
        }

        const dataToExport = messages.map(msg => {
            const content = msg.parts.map(part => {
                if (part.text) return part.text;
                if (part.inlineData) return `[Image Content: ${part.inlineData.mimeType}]`;
                return '';
            }).join('\n');

            return {
                Timestamp: new Date().toISOString(),
                Role: msg.role,
                Content: content
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "ChatHistory");
        XLSX.writeFile(workbook, "chat-history.xlsx");
    };

    const handleSaveSettings = () => {
        if (!tempApiKeyRef.current.trim()) {
            alert("API Key cannot be empty.");
            return;
        }
        setApiKey(tempApiKeyRef.current);
        localStorage.setItem('gemini-api-key', tempApiKeyRef.current);
        alert("API Key saved.");
    };

    const handleModelChange = (newModel: string) => {
        setModel(newModel);
        localStorage.setItem('gemini-model', newModel);
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert("Please upload a valid image file.");
            return;
        }

        setImageMimeType(file.type);
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setImagePreview(base64String);
            setImageData(base64String.split(',')[1]);
        };
        reader.readAsDataURL(file);
    };

    const handleSendMessage = async () => {
        if ((!inputMessage.trim() && !imageData) || isLoading) return;
        if (!apiKey) {
            alert("Please set your API Key in the right sidebar first.");
            return;
        }

        setIsLoading(true);

        // --- Construct User Message ---
        const userParts: Part[] = [];
        if (inputMessage.trim()) {
            userParts.push({text: inputMessage});
        }
        if (imageData && imageMimeType) {
            userParts.push({inlineData: {mimeType: imageMimeType, data: imageData}});
        }
        const userMessage: Message = {role: 'user', parts: userParts};

        // --- Construct Request Body ---
        const contents = [...messages, userMessage];
        const requestBody = {contents};

        // Add user message and empty model message to UI
        setMessages(prev => [...prev, userMessage, {role: 'model', parts: [{text: ''}]}]);
        setInputMessage('');
        clearImageData();

        const isImageRelatedModel = model.includes('image');

        try {
            if (isImageRelatedModel) {
                // --- NON-STREAMING FOR ALL IMAGE-RELATED MODELS ---
                const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    throw new Error(`API Error: ${response.status} ${response.statusText}`);
                }

                const responseData = await response.json();
                console.log('API Response:', JSON.stringify(responseData, null, 2));

                const modelResponseParts = responseData.candidates?.[0]?.content?.parts;

                if (modelResponseParts) {
                    setMessages(prev => prev.map((msg, i) => i === prev.length - 1 ? {
                        ...msg,
                        parts: modelResponseParts
                    } : msg));
                } else {
                    const errorText = responseData.candidates?.[0]?.finishReason || "No content returned.";
                    const textResponse = `Sorry, I couldn't generate a response. Reason: ${errorText}`;
                    setMessages(prev => prev.map((msg, i) => i === prev.length - 1 ? {
                        ...msg,
                        parts: [{text: textResponse}]
                    } : msg));
                }

            } else {
                // --- STREAMING FOR TEXT-ONLY MODELS ---
                const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    throw new Error(`API Error: ${response.status} ${response.statusText}`);
                }
                if (!response.body) {
                    throw new Error("Response body is null");
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let partialResponse = '';

                while (true) {
                    const {done, value} = await reader.read();
                    if (done) break;

                    partialResponse += decoder.decode(value, {stream: true});
                    let dataEndIndex;
                    while ((dataEndIndex = partialResponse.indexOf('\n')) !== -1) {
                        const completeData = partialResponse.substring(0, dataEndIndex);
                        partialResponse = partialResponse.substring(dataEndIndex + 1);
                        if (completeData.startsWith('data: ')) {
                            try {
                                const jsonString = completeData.substring(6);
                                const chunk = JSON.parse(jsonString);
                                const part = chunk.candidates[0]?.content?.parts[0];
                                if (part?.text) {
                                    setMessages(prev => prev.map((msg, i) => {
                                        if (i === prev.length - 1) {
                                            const newParts = [...msg.parts];
                                            // Append to the last text part, or create a new one
                                            const lastPart = newParts[newParts.length - 1];
                                            if (lastPart && lastPart.text !== undefined) {
                                                lastPart.text += part.text;
                                            } else {
                                                newParts.push({text: part.text});
                                            }
                                            return {...msg, parts: newParts};
                                        }
                                        return msg;
                                    }));
                                }
                            } catch (e) { /* Ignore parsing errors of incomplete chunks */
                            }
                        }
                    }
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(errorMessage);
            setMessages(prev => prev.map((msg, i) => i === prev.length - 1 ? {
                ...msg,
                parts: [{text: `An error occurred: ${errorMessage}`}]
            } : msg));
        } finally {
            setIsLoading(false);
        }
    };

    // --- Render ---
    return (
        <div className="flex flex-1 font-sans text-gray-900 bg-white">
            {/* Left Sidebar */}
            <aside className="w-64 flex flex-col items-start p-4 bg-gray-50 border-r border-gray-200 space-y-2">
                <button onClick={handleNewChat}
                        className="flex items-center justify-start w-full px-4 rounded-lg hover:bg-gray-200">
                    <IconPlus/><span className="ml-3 font-medium">New Chat</span>
                </button>
                <button onClick={handleExportExcel}
                        className="flex items-center justify-start w-full px-4 rounded-lg hover:bg-gray-200">
                    <IconDownload/><span className="ml-3 font-medium">Export Excel</span>
                </button>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-2xl mx-auto space-y-6">
                        {messages.length === 0 && !isLoading &&
                            <div className="text-center text-gray-500">Start a conversation...</div>}
                        {messages.map((msg, index) => (
                            <div key={index}
                                 className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`max-w-lg lg:max-w-2xl px-4 py-3 rounded-xl shadow ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                                    <div
                                        className="prose prose-sm max-w-none prose-pre:bg-gray-800 prose-pre:text-gray-100 ${msg.role === 'user' ? 'prose-invert' : ''}">
                                        {msg.parts.map((part, i) => {
                                            if (part.inlineData) {
                                                const imgUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                                                return <img key={i} src={imgUrl} alt="Generated content"
                                                            className="rounded-md"/>;
                                            }
                                            if (part.text) {
                                                return <ReactMarkdown key={i}
                                                                      remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>;
                                            }
                                            return null;
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isLoading && messages[messages.length - 1]?.parts.every(p => !p.text && !p.inlineData) && (
                            <div className="flex justify-start">
                                <div className="px-4 py-3 rounded-xl shadow bg-gray-100 animate-pulse"><p
                                    className="text-gray-600">Thinking...</p></div>
                            </div>
                        )}
                        <div ref={messagesEndRef}/>
                    </div>
                </div>

                {/* Input Area */}
                <div className="px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-2 border-t border-gray-200">
                    <div className="max-w-2xl mx-auto">
                        {imagePreview && (
                            <div className="mb-4 relative w-32">
                                <img src={imagePreview} alt="Image preview" className="rounded-lg"/>
                                <button onClick={clearImageData}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold">X
                                </button>
                            </div>
                        )}
                        <div
                            className="flex items-center p-2 rounded-lg border border-gray-300 focus-within:border-blue-500 bg-gray-50">
                            <button onClick={() => fileInputRef.current?.click()}
                                    className="p-2 text-gray-500 hover:text-gray-800"><IconImage/></button>
                            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*"
                                   className="hidden"/>
                            <textarea
                                placeholder="Type a message, or upload an image to ask about it..."
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                className="flex-1 p-2 bg-transparent focus:outline-none resize-none h-auto max-h-48"
                                rows={1} disabled={isLoading}
                            />
                            <button onClick={handleSendMessage} disabled={isLoading}
                                    className="p-2 text-gray-500 disabled:text-gray-300 hover:text-blue-600"><IconSend/>
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Right Sidebar */}
            <aside className="w-80 p-4 bg-gray-50 border-l border-gray-200 flex flex-col space-y-6">
                <h2 className="text-lg font-semibold">Settings</h2>
                <div>
                    <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                    <select id="model-select" value={model} onChange={(e) => handleModelChange(e.target.value)}
                            className="w-full p-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isLoading}>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-flash-image-preview">Gemini 2.5 Image Preview</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-700 mb-1">API
                        Key</label>
                    <input id="api-key-input" type="password" placeholder="Your Google AI API Key" defaultValue={apiKey}
                           onChange={(e) => tempApiKeyRef.current = e.target.value}
                           className="w-full p-2 border border-gray-300 rounded-md mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    <button onClick={handleSaveSettings}
                            className="w-full px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md font-semibold">Save
                        Key
                    </button>
                </div>
            </aside>
        </div>
    );
}
