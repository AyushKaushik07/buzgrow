"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Database, LucideLoader2, MoveUp, RefreshCcw } from 'lucide-react';

type Props = {}

const VectorDBPage = (props: Props) => {
  const [isUploading, setIsUploading] = useState(false);
  const [indexname, setIndexname] = useState("");
  const [namespace, setNamespace] = useState("");

  const onStartUpload = async () => {
    setIsUploading(true);
    try {
      const response = await fetch('api/updatedatabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          indexname,
          namespace
        })
      });

      console.log(await response.json());
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="flex flex-col items-center p-24">
      <Card>
        <CardHeader>
          <CardTitle>Update Knowledge Base</CardTitle>
          <CardDescription>Add new documents to your vector DB</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-3 gap-4">

            <div className="col-span-2 grid gap-4 border rounded-lg p-6">

              <div className="relative grid gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -right-4 -top-4"
                >
                  <RefreshCcw size={20} />
                </Button>

                <Label>Files List:</Label>
                <Textarea
                  readOnly
                  placeholder="Selected files will appear here..."
                  className="min-h-24 resize-none border p-3 shadow-none text-sm text-muted-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Index Name</Label>
                  <Input
                    value={indexname} onChange={e => setIndexname(e.target.value)}
                    placeholder="Enter index name"
                    disabled={isUploading}
                    className="disabled:cursor-default"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Namespace</Label>
                  <Input
                    value={namespace} onChange={e => setNamespace(e.target.value)}
                    placeholder="Enter namespace"
                    disabled={isUploading}
                    className="disabled:cursor-default"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={onStartUpload}
              variant="outline"
              className="w-full h-full"
              disabled={isUploading}
            >
              <span className="flex flex-row items-center gap-2">
                <Database size={50} className="stroke-[#D90013]" />
                <MoveUp className="stroke-[#D90013]" />
              </span>
            </Button>
          </div>
          {isUploading && <div className='mt-4'>
            <label>File Name:</label>
            <div className='flex flex-row items-center gap-4'>
              <progress value={80} />
              <LucideLoader2 className='stroke-[#D90013] animate-spin' />
            </div>
          </div>}
        </CardContent>
      </Card>
    </main>
  );
};

export default VectorDBPage;
