import { updateVectorDB } from "@/utils";
import { Pinecone } from "@pinecone-database/pinecone";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getFilename(path: string): string {
  const separator = path.includes('\\') ? '\\' : '/';
  const docname = path.substring(path.lastIndexOf(separator) + 1);
  return docname;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { indexname, namespace } = await request.json();
        
        if (!indexname?.trim()) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: "Index name required" }) + '\n'));
          controller.close();
          return;
        }
        
        if (!namespace?.trim()) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: "Namespace required" }) + '\n'));
          controller.close();
          return;
        }

        const loader = new DirectoryLoader('./documents', {
          '.pdf': (path: string) => new PDFLoader(path, { splitPages: false }),
          '.txt': (path: string) => new TextLoader(path),
        });

        const docs = await loader.load();

        const fileList = docs.map(doc => getFilename(doc.metadata.source));
        controller.enqueue(encoder.encode(JSON.stringify({ fileList }) + '\n'));

        const client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
        await updateVectorDB({
          client,
          indexname,
          namespace,
          docs,
          progressCallback: (filename, totalChunks, chunksUpserted, isComplete) => {
            const progressData = {
              filename,
              totalChunks,
              chunksUpserted,
              isComplete,
              progress: totalChunks > 0 ? Math.round((chunksUpserted / totalChunks) * 100) : 0
            };
            controller.enqueue(encoder.encode(JSON.stringify(progressData) + '\n'));
          }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encoder.encode(JSON.stringify({ error: errorMessage }) + '\n'));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
