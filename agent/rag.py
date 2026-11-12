# RAG part of StudyPilot: read notes, split into chunks, store in ChromaDB, search.
import io
import uuid
from pathlib import Path

import chromadb

CHUNK_WORDS = 180      # size of each piece of the notes
OVERLAP_WORDS = 40     # words shared between neighbouring pieces, so ideas are not cut in half
MAX_CHUNKS = 1500      # protects the free hosting and the API quota
SUPPORTED = ('.pdf', '.txt', '.md')


def extract_pages(filename, data):
    """Return a list of (page_number, text). Text files count as page 1."""
    suffix = Path(filename).suffix.lower()
    if suffix == '.pdf':
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        pages = []
        for number, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or '').strip()
            if text:
                pages.append((number, text))
        return pages
    if suffix in ('.txt', '.md'):
        return [(1, data.decode('utf-8', errors='ignore'))]
    raise ValueError('Unsupported file type: ' + suffix + '. Use PDF, TXT or MD.')


def chunk_text(text, size=CHUNK_WORDS, overlap=OVERLAP_WORDS):
    words = text.split()
    if not words:
        return []
    step = max(size - overlap, 1)
    chunks = []
    for start in range(0, len(words), step):
        piece = words[start:start + size]
        chunks.append(' '.join(piece))
        if start + size >= len(words):
            break
    return chunks


class NotesIndex:
    """One index per visitor. It lives in memory, so nobody sees another person's notes."""

    def __init__(self, embedding_function=None):
        self._client = chromadb.EphemeralClient()
        options = {}
        if embedding_function is not None:
            options['embedding_function'] = embedding_function
        # Unique name, because in-memory Chroma is shared by the whole server process
        self._collection = self._client.create_collection(
            name='notes_' + uuid.uuid4().hex, **options
        )
        self._chunks = []      # (text, source, page) in reading order, used by overview()
        self.files = []

    @property
    def count(self):
        return len(self._chunks)

    def add_file(self, filename, data):
        """Add one uploaded file. Returns how many chunks were stored."""
        if filename in self.files:
            return 0
        pages = extract_pages(filename, data)
        new = []
        for page_number, text in pages:
            for piece in chunk_text(text):
                new.append((piece, filename, page_number))
        if not new:
            raise ValueError('No readable text found in ' + filename + '. Scanned PDFs need OCR.')
        if len(self._chunks) + len(new) > MAX_CHUNKS:
            raise ValueError('Notes are too large for this demo. Upload a smaller file.')
        start = len(self._chunks)
        self._collection.add(
            ids=['c' + str(start + i) for i in range(len(new))],
            documents=[item[0] for item in new],
            metadatas=[{'source': item[1], 'page': item[2]} for item in new],
        )
        self._chunks.extend(new)
        self.files.append(filename)
        return len(new)

    def search(self, query, k=4):
        """Return the k most relevant pieces as dicts: text, source, page."""
        if not self._chunks:
            return []
        result = self._collection.query(
            query_texts=[query], n_results=min(k, len(self._chunks))
        )
        hits = []
        for text, meta in zip(result['documents'][0], result['metadatas'][0]):
            hits.append({'text': text, 'source': meta['source'], 'page': meta['page']})
        return hits

    def overview(self, max_chunks=10):
        """Pieces spread evenly across all notes, to see what the notes cover."""
        if not self._chunks:
            return []
        if len(self._chunks) <= max_chunks:
            chosen = self._chunks
        else:
            step = len(self._chunks) / max_chunks
            chosen = [self._chunks[int(i * step)] for i in range(max_chunks)]
        return [{'text': t, 'source': s, 'page': p} for t, s, p in chosen]


def format_hits(hits):
    """Turn search results into text with source labels the model can cite."""
    parts = []
    for hit in hits:
        parts.append('[' + hit['source'] + ' p.' + str(hit['page']) + '] ' + hit['text'])
    return '\n\n'.join(parts)
