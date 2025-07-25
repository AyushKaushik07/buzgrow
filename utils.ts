import { FeatureExtractionPipeline, pipeline } from "@xenova/transformers";
import { Pinecone, PineconeRecord, RecordMetadata } from "@pinecone-database/pinecone";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
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

  // Final completion callback
  progressCallback("", 0, 0, true);
}

async function processDocument(
  client: Pinecone,
  indexname: string,
  namespace: string,
  doc: Document,
  extractor: FeatureExtractionPipeline,
  progressCallback: (filename: string, totalChunks: number, chunksUpserted: number, iscomplete: boolean) => void
): Promise<void> {
  const splitter = new RecursiveCharacterTextSplitter();
  const documentChunks = await splitter.splitText(doc.pageContent);
  const totalChunks = documentChunks.length;
  let chunksUpserted = 0;
  const filename = getFilename(doc.metadata.source);

  console.log(`Processing ${filename} with ${totalChunks} chunks`);
  
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
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

function getFilename(path: string): string {
  // Handle both Windows (\) and Unix (/) path separators
  const windowsPath = path.includes('\\');
  const separator = windowsPath ? '\\' : '/';
  const docname = path.substring(path.lastIndexOf(separator) + 1);
  const nameWithoutExt = docname.substring(0, docname.lastIndexOf("."));
  return nameWithoutExt || docname;
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
  const output = await extractor(chunkBatch.map(str => str.replace(/\n/g, ' ')), { pooling: 'cls' });
  const embeddingsBatch = Array.isArray(output) ? output : output.tolist();

  const vectorBatch = chunkBatch.map((chunk, i) => ({
    id: `diagnostictests-2-${chunkBatch.length}-${(i + 1) * 10}-false`,
    values: embeddingsBatch[i],
    metadata: { chunk }
  }));

  // Validate payload size
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
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
  return 0;
}
