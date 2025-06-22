import { FeatureExtractionPipeline, pipeline } from "@xenova/transformers";
import { Pinecone, PineconeRecord, RecordMetadata } from "@pinecone-database/pinecone";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { batchsize } from "./config";

export async function updateVectorDB(params: {
  client: Pinecone;
  indexname: string;
  namespace: string;
  docs: Document[];
  progressCallback: (filename: string, totalChunks: number, chunksUpserted: number, iscomplete: boolean) => void;
}): Promise<void> {
  const { client, indexname, namespace, docs, progressCallback } = params;

  const modelname = 'mixedbread-ai/mxbai-embed-large-v1';
  const extractor: FeatureExtractionPipeline = await pipeline(
    'feature-extraction',
    modelname,
    { quantized: false }
  );

  for (const doc of docs) {
    await processDocument(
      client,
      indexname,
      namespace,
      doc,
      extractor,
      progressCallback
    );
  }

  progressCallback("", 0, 0, true);
}

// Optimized chunking with semantic boundaries and overlap
async function createOptimizedChunks(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: [
      "\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " ", ""
    ],
  });
  
  return await splitter.splitText(text);
}

async function processDocument(
  client: Pinecone,
  indexname: string,
  namespace: string,
  doc: Document,
  extractor: FeatureExtractionPipeline,
  progressCallback: (filename: string, totalChunks: number, chunksUpserted: number, iscomplete: boolean) => void
): Promise<void> {
  const documentChunks = await createOptimizedChunks(doc.pageContent);
  const totalChunks = documentChunks.length;
  let chunksUpserted = 0;
  const filename = getFilename(doc.metadata.source);

  console.log(`Processing ${filename} with ${totalChunks} optimized chunks`);
  
  while (documentChunks.length > 0) {
    const chunkBatch = documentChunks.splice(0, batchsize);
    chunksUpserted += await processOneBatch(
      client,
      indexname,
      namespace,
      extractor,
      chunkBatch,
      filename,
      totalChunks,
      chunksUpserted,
      progressCallback
    );
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

function getFilename(path: string): string {
  const separator = path.includes('\\') ? '\\' : '/';
  const docname = path.substring(path.lastIndexOf(separator) + 1);
  return docname.substring(0, docname.lastIndexOf(".")) || docname;
}

async function processOneBatch(
  client: Pinecone,
  indexname: string,
  namespace: string,
  extractor: FeatureExtractionPipeline,
  chunkBatch: string[],
  filename: string,
  totalChunks: number,
  currentUpserted: number,
  progressCallback: (filename: string, totalChunks: number, chunksUpserted: number, iscomplete: boolean) => void
): Promise<number> {
  const processedChunks = chunkBatch.map(chunk => 
    chunk.replace(/\s+/g, ' ').trim()
  );
  
  const output = await extractor(processedChunks, { pooling: 'cls' });
  const embeddingsBatch = Array.isArray(output) ? output : output.tolist();

  const vectorBatch = chunkBatch.map((chunk, i) => {
    const chunkNumber = currentUpserted + i + 1;
    const uniqueID = `${filename}-chunk-${String(chunkNumber).padStart(4, '0')}`;
    
    return {
      id: uniqueID,
      values: embeddingsBatch[i],
      metadata: { 
        text: chunk,
        filename,
        chunkNumber,
        totalChunks,
        chunkSize: chunk.length
      }
    } as PineconeRecord<RecordMetadata>;
  });

  const payloadSize = Buffer.byteLength(JSON.stringify(vectorBatch));
  if (payloadSize > 2 * 1024 * 1024) {
    throw new Error(`Batch size ${(payloadSize/1024/1024).toFixed(2)}MB exceeds 2MB limit`);
  }

  const index = client.Index(indexname).namespace(namespace);
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await index.upsert(vectorBatch);
      const newUpserted = currentUpserted + vectorBatch.length;
      progressCallback(filename, totalChunks, newUpserted, false);
      return vectorBatch.length;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(`Retrying upsert (attempt ${attempt})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  return 0;
}
