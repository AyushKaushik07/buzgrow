import { pipeline } from '@xenova/transformers';

const run = async () => {
  const extractor = await pipeline(
    'feature-extraction',
    'mixedbread-ai/mxbai-embed-large-v1',
    {
      quantized: false, // <--- IMPORTANT: This disables the smaller quantized model
    }
  );
  const output = await extractor('Hello world');
  console.dir(extractor, { depth: null }); // Optional: See full structure
  console.log(output);
};

run();
