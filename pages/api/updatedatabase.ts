import { updateVectorDB } from "@/utils";
import { Pinecone } from "@pinecone-database/pinecone";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        try {
            const { indexname, namespace } = req.body;

            if (!indexname || typeof indexname !== 'string') {
                return res.status(400).json({ message: "Index name is required and must be a non-empty string." });
            }

            if (!namespace || typeof namespace !== 'string') {
                return res.status(400).json({ message: "Namespace is required and must be a non-empty string." });
            }

            await handleUpload(indexname, namespace, res);
        } catch (error) {
            console.error("Error parsing request or uploading:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    } else {
        res.status(405).json({ message: "Method Not Allowed" });
    }
}

async function handleUpload(indexname: string, namespace: string, res: NextApiResponse) {
    const loader = new DirectoryLoader('./documents', {
        '.pdf': (path: string) => new PDFLoader(path, { splitPages: false }),
        '.txt': (path: string) => new TextLoader(path),
    });

    const docs = await loader.load();

    const client = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!,
    });

    await updateVectorDB({
        client,
        indexname,
        namespace,
        docs,
        progressCallback: (filename, totalChunks, iscomplete) => {
            console.log(`${filename} - ${iscomplete ? "Completed" : "Processing..."}`);
        }
    });

    res.status(200).json({ message: "Upload complete" });
}
