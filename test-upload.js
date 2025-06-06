const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const PINECONE_API_KEY = "pcsk_3bPAM1_K1cPdSyWCu7paZjmkorUeKCETJMXKyjEb4xuiJ8Hpd6cejrFhD24QaRrbxT7y8c";
const PINECONE_ENVIRONMENT = "us-east-1"; 
const INDEX_NAME = "index-one"; 

const BASE_URL = `https://${INDEX_NAME}-${PINECONE_ENVIRONMENT}.svc.pinecone.io`;

app.post("/upload-vectors", async (req, res) => {
  const { vectors } = req.body;

  try {
    const response = await axios.post(`${BASE_URL}/vectors/upsert`, {
      vectors: vectors
    }, {
      headers: {
        "Api-Key": PINECONE_API_KEY,
        "Content-Type": "application/json"
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});
