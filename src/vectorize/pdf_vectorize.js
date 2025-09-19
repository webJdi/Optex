const fs = require('fs');
const pdfParse = require('pdf-parse');
const { vectorizeText } = require('./vertex_vectorize');
const { db } = require('../src/services/firebase');
const { collection, addDoc } = require('firebase/firestore');

async function processPDF(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);
  const textChunks = data.text.split('\n\n').filter(Boolean);

  for (const chunk of textChunks) {
    const vector = await vectorizeText(chunk);
    // Store each chunk and its vector in Firestore
    await addDoc(collection(db, 'cement_doc_chunks'), {
      chunk,
      vector,
      timestamp: new Date().toISOString(),
    });
  }
  console.log('PDF vectorization and Firestore storage complete!');
}

processPDF('d:/github/Optex/vectorize/cement_doc.pdf');
