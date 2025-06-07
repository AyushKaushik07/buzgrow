"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Database, LucideLoader2, MoveUp, RefreshCcw } from 'lucide-react';

const VectorDBPage = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [indexname, setIndexname] = useState("");
  const [namespace, setNamespace] = useState("");
  const [filename, setFilename] = useState("");
  const [progress, setProgress] = useState(0);
  const [currentChunks, setCurrentChunks] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [fileList, setFileList] = useState<string[]>([]);

  const onStartUpload = async () => {
    if (!indexname.trim() || !namespace.trim()) {
      alert('Please enter both Index Name and Namespace');
      return;
    }

    setProgress(0);
    setFilename("");
    setCurrentChunks(0);
    setTotalChunks(0);
    setFileList([]);
    setIsUploading(true);
    
    try {
      const response = await fetch('/api/updatedatabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indexname, namespace })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await processStreamedProgress(response);
    } catch (err) {
      console.error("Upload error:", err);
      alert('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsUploading(false);
      setProgress(100);
    }
  };

  const processStreamedProgress = async (response: Response) => {
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('No reader available');
      return;
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream completed');
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              console.log('Frontend received:', data);
              
              if (data.error) {
                console.error('Server Error:', data.error);
                alert('Server Error: ' + data.error);
                return;
              }

              if (data.fileList) {
                setFileList(data.fileList);
                continue;
              }
              
              if (data.filename && typeof data.totalChunks === 'number' && typeof data.chunksUpserted === 'number') {
                setFilename(data.filename);
                setCurrentChunks(data.chunksUpserted);
                setTotalChunks(data.totalChunks);
                setProgress(data.progress || 0);
              }
              
              if (data.isComplete) {
                console.log('Processing completed');
                setProgress(100);
              }
            } catch (parseError) {
              console.error('JSON parse error:', parseError, 'Raw line:', line);
            }
          }
        }
      }
    } catch (error) {
      console.error('Stream reading error:', error);
    } finally {
      reader.releaseLock();
    }
  };

  return (
    <main className="flex flex-col items-center p-24 min-w-[800px]">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-2xl">Update Knowledge Base</CardTitle>
          <CardDescription className="text-base">
            Add new documents to your vector DB
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-6">
              <div className="border rounded-lg p-6 space-y-4">
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-0 right-0 -mt-3 -mr-3"
                  >
                    <RefreshCcw className="h-5 w-5" />
                  </Button>
                  <div className="space-y-2">
                    <Label className="text-base">Files List:</Label>
                    <Textarea
                      readOnly
                      placeholder="Files from ./documents folder will be processed..."
                      className="min-h-[120px] text-base p-4"
                      value={fileList.join('\n')}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-base">Index Name</Label>
                    <Input
                      value={indexname}
                      onChange={(e) => setIndexname(e.target.value)}
                      placeholder="Enter index name"
                      className="h-12 text-base"
                      disabled={isUploading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base">Namespace</Label>
                    <Input
                      value={namespace}
                      onChange={(e) => setNamespace(e.target.value)}
                      placeholder="Enter namespace"
                      className="h-12 text-base"
                      disabled={isUploading}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <Button
                onClick={onStartUpload}
                variant="outline"
                className="w-full h-full p-6 flex flex-col items-center justify-center space-y-2 border-2 border-dashed hover:border-solid"
                disabled={isUploading}
              >
                <Database className="h-12 w-12 stroke-[#D90013]" />
                <MoveUp className="h-8 w-8 stroke-[#D90013]" />
                <span className="text-lg font-medium text-[#D90013]">
                  Upload to VectorDB
                </span>
              </Button>
            </div>
          </div>

          {isUploading && (
            <div className="mt-6 space-y-3">
              <div className="text-base font-medium">
                File Name: {filename} [{currentChunks}/{totalChunks}]
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div 
                    className="h-full bg-[#D90013] transition-all duration-300 ease-out rounded-full" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <LucideLoader2 className="h-5 w-5 stroke-[#D90013] animate-spin flex-shrink-0" />
              </div>
              <div className="text-sm text-gray-600">
                Progress: {progress.toFixed(1)}%
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default VectorDBPage;
