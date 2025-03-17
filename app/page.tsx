'use client';

import { useState, useRef, useEffect } from 'react';
import { Message, Model, ModelType } from './types';
import Header from './component/Header';
import ChatMessages from './component/ChatMessages';
import ChatInput from './component/ChatInput';
import MobileSearchUI from './component/MobileSearchUI';
import DesktopSearchUI from './component/DesktopSearchUI';
import Sidebar from './component/Sidebar';
import { fetchResponse } from './api/apiService';
import modelsData from '../models.json';

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('exa');
  const [models, setModels] = useState<Model[]>([
    {
      id: 'exa',
      name: 'Exa Search',
      provider: 'Exa',
      providerId: 'exa',
      enabled: true,
      toolCallType: 'native',
      searchMode: true
    }
  ]);
  const [autoprompt, setAutoprompt] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Add Exa as the first option and then add all Groq models
    const groqModels = modelsData.models.filter(model => model.providerId === 'groq');
    setModels(prevModels => [...prevModels, ...groqModels]);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value as ModelType);
  };

  const toggleAutoprompt = () => {
    setAutoprompt(!autoprompt);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const messageId = Date.now().toString();
    const userMessage: Message = {
      id: messageId,
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      abortControllerRef.current = new AbortController();
      
      await fetchResponse(
        input,
        messages,
        selectedModel,
        abortControllerRef.current,
        setMessages,
        assistantMessage
      );
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error fetching response:', error);
        
        // Update the assistant message with the error
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, content: 'Sorry, there was an error processing your request. Please try again.' } 
              : msg
          )
        );
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Determine if we have any messages
  const hasMessages = messages.length > 0;

  // Determine if the selected model is Exa
  const isExa = selectedModel === 'exa';

  // Get the provider name for the selected model
  const selectedModelObj = models.find(model => model.id === selectedModel);
  const providerName = selectedModelObj?.provider || 'AI';

  return (
    <>
      <Header toggleSidebar={toggleSidebar} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {!hasMessages ? (
        <>
          <MobileSearchUI 
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            selectedModel={selectedModel}
            handleModelChange={handleModelChange}
            models={models}
            autoprompt={autoprompt}
            toggleAutoprompt={toggleAutoprompt}
            setInput={setInput}
            messages={messages}
            isExa={selectedModel.includes('exa')}
            providerName={selectedModel.includes('exa') ? 'Exa' : 'Groq'}
          />
          <DesktopSearchUI 
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            selectedModel={selectedModel}
            handleModelChange={handleModelChange}
            models={models}
            autoprompt={autoprompt}
            toggleAutoprompt={toggleAutoprompt}
            setInput={setInput}
            isExa={selectedModel.includes('exa')}
            providerName={selectedModel.includes('exa') ? 'Exa' : 'Groq'}
            messages={messages}
          />
        </>
      ) : (
        <>
          <ChatMessages 
            messages={messages} 
            isLoading={isLoading} 
            selectedModel={selectedModel}
            selectedModelObj={selectedModelObj}
            isExa={isExa}
          />

          {/* Input Form - Only show when there are messages */}
          {hasMessages && (
            <ChatInput 
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              selectedModel={selectedModel}
              handleModelChange={handleModelChange}
              models={models}
              isExa={isExa}
            />
          )}
        </>
      )}
    </>
  );
}
 