import { FeatureExtractionPipeline, pipeline } from "@xenova/transformers";
import { Pinecone, PineconeRecord, RecordMetadata } from "@pinecone-database/pinecone";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { batchsize } from "./config";

let callback: (filename: string, totalChunks: number, chunksUpserted: number, iscomplete: boolean) => void;
let totalDocumentChunks = 0;
let totalDocumentChunksUpseted = 0;

export async function updateVectorDB(params: {
  client: Pinecone;
  indexname: string;
  namespace: string;
  docs: Document[];
  progressCallback: (filename: string, totalChunks: number, chunksUpserted: number, iscomplete: boolean) => void;
}): Promise<void> {
  const { client, indexname, namespace, docs, progressCallback } = params;
  callback = progressCallback;

  const modelname = 'mixedbread-ai/mxbai-embed-large-v1';

  const extractor: FeatureExtractionPipeline = await pipeline(
    'feature-extraction',
    modelname,
    { quantized: false }
  );

  console.log('Extractor initialized:');
  console.dir(extractor, { depth: null });

  for (const doc of docs) {
    await processDocument(client, indexname, namespace, doc, extractor);
  }

  if (callback !== undefined) {
    callback("filename", totalDocumentChunks, totalDocumentChunksUpseted, true);
  }
}

async function processDocument(
  client: Pinecone,
  indexname: string,
  namespace: string,
  doc: Document,
  extractor: FeatureExtractionPipeline
): Promise<void> {
  const splitter = new RecursiveCharacterTextSplitter();
  const documentChunks = await splitter.splitText(doc.pageContent);

  totalDocumentChunks = documentChunks.length;
  totalDocumentChunksUpseted = 0;
  const filename = getFilename(doc.metadata.source);

  console.log(`Total Chunks for ${filename}:`, documentChunks.length);
  let chunkBatchIndex = 0;

  while (documentChunks.length > 0) {
    chunkBatchIndex++;
    const chunkBatch = documentChunks.splice(0, batchsize);
    await processOneBatch(client, indexname, namespace, extractor, chunkBatch, chunkBatchIndex, filename);
  }
}

function getFilename(path: string): string {
  const docname = path.substring(path.lastIndexOf("/") + 1);
  return docname.substring(0, docname.lastIndexOf(".")) || docname;
}

async function processOneBatch(
  client: Pinecone,
  indexname: string,
  namespace: string,
  extractor: FeatureExtractionPipeline,
  chunkBatch: string[],
  chunkBatchIndex: number,
  filename: string
): Promise<void> {
  const output = await extractor(chunkBatch.map(str => str.replace(/\n/g, ' ')), {
    pooling: 'cls'
  });

  const embeddingsBatch = output.tolist();
  let vectorBatch: PineconeRecord<RecordMetadata>[] = [];

  for (let i = 0; i < chunkBatch.length; i++) {
    const chunk = chunkBatch[i];
    const embedding = embeddingsBatch[i];

    const vector: PineconeRecord<RecordMetadata> = {
      // Format: diagnostictests 2-4600-10-false
      id: `diagnostictests 2-${chunkBatch.length}-${(i + 1) * 10}-false`,
      values: embedding,
      metadata: { chunk }
    };

    vectorBatch.push(vector);
  }

  const index = client.Index(indexname).namespace(namespace);
  await index.upsert(vectorBatch);
  console.log(`Upserted ${vectorBatch.length} vectors to index "${indexname}" under namespace "${namespace}".`);
  totalDocumentChunksUpseted += vectorBatch.length;

  if (callback !== undefined) {
    callback(filename, totalDocumentChunks, totalDocumentChunksUpseted, false);
  }

  vectorBatch = [];
}
