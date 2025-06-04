import { FeatureExtractionPipeline, pipeline } from "@xenova/transformers"; // Not Hugging Face
import { Pinecone } from "@pinecone-database/pinecone";
import { Document } from "langchain/document";

export async function updateVectorDB(params: {
  client: Pinecone,
  indexname: string,
  namespace: string,
  docs: Document[],
  progressCallback: (filename: string, totalChunks: number, iscomplete: boolean) => void
}): Promise<void> {
  const { client, indexname, namespace, docs, progressCallback } = params;

  const modelname = 'mixedbread-ai/mxbai-embed-large-v1';
  
  // Properly typed extractor
  const extractor: FeatureExtractionPipeline = await pipeline(
    'feature-extraction',
    modelname,
    {
      quantized: false, // Use full model
    }
  );

  // Use dir for deep object inspection
  console.log('Extractor initialized:');
  console.dir(extractor, { depth: null });  // <- Use this to see nested tokenizer/model structure

  for (const doc of docs) {
    await processDocument(client, indexname, namespace, doc, extractor);
  }
}

function processDocument(
  client: Pinecone,
  indexname: string,
  namespace: string,
  doc: Document,
  extractor: FeatureExtractionPipeline
): void {
  console.log('Processing document:', doc);
  // Add processing logic here

