import { updateVectorDB } from "@/utils";
import { Pinecone } from "@pinecone-database/pinecone";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { indexname, namespace } = req.body; // req.body is already parsed
        await handleUpload(indexname, namespace, res);
    } else {
        res.status(405).json({ message: "Method Not Allowed" });
    }
}

async function handleUpload(indexname: string, namespace: string, res: NextApiResponse) {
    const loader = new DirectoryLoader('./documents', {
        '.pdf': (path: string) => new PDFLoader(path, {
            splitPages: false
        }),
        '.txt': (path: string) => new TextLoader(path)
    });

    const docs = await loader.load();

    const client = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!
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
