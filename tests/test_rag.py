import hashlib

import chromadb
import pytest

from agent.rag import NotesIndex, chunk_text, extract_pages, format_hits


class FakeEmbedding(chromadb.EmbeddingFunction):
    """Tiny offline embedding so tests need no model download."""

    def __init__(self):
        pass

    def __call__(self, input):
        vectors = []
        for text in input:
            vec = [0.0] * 64
            for word in text.lower().split():
                vec[int(hashlib.md5(word.encode()).hexdigest(), 16) % 64] += 1.0
            vectors.append(vec)
        return vectors

    @staticmethod
    def name():
        return 'fake-hash'

    def get_config(self):
        return {}

    @staticmethod
    def build_from_config(config):
        return FakeEmbedding()


def make_index():
    return NotesIndex(embedding_function=FakeEmbedding())


def test_chunk_text_overlaps_and_covers_everything():
    text = ' '.join(str(i) for i in range(500))
    chunks = chunk_text(text, size=100, overlap=20)
    assert chunks[0].split()[0] == '0'
    assert chunks[-1].split()[-1] == '499'
    assert chunks[0].split()[-20:] == chunks[1].split()[:20]


def test_chunk_text_empty():
    assert chunk_text('   ') == []


def test_extract_pages_text_file():
    assert extract_pages('a.txt', b'hello world') == [(1, 'hello world')]


def test_extract_pages_rejects_other_types():
    with pytest.raises(ValueError):
        extract_pages('a.docx', b'x')


def test_search_finds_the_right_file():
    index = make_index()
    index.add_file('dbms.txt', b'normalization removes redundancy using normal forms like 1NF 2NF 3NF')
    index.add_file('os.txt', b'a process scheduler decides which process runs on the cpu next')
    hits = index.search('what is normalization', k=1)
    assert hits[0]['source'] == 'dbms.txt'


def test_same_file_is_not_added_twice():
    index = make_index()
    assert index.add_file('a.txt', b'some notes here') == 1
    assert index.add_file('a.txt', b'some notes here') == 0
    assert index.count == 1


def test_empty_index_returns_nothing():
    index = make_index()
    assert index.search('anything') == []
    assert index.overview() == []


def test_two_visitors_do_not_share_notes():
    one, two = make_index(), make_index()
    one.add_file('a.txt', b'secret notes of visitor one')
    assert two.search('secret') == []


def test_overview_is_limited():
    index = make_index()
    index.add_file('big.txt', (' '.join(['word'] * 5000)).encode())
    assert len(index.overview(max_chunks=10)) == 10


def test_format_hits_has_source_labels():
    text = format_hits([{'text': 'abc', 'source': 'n.pdf', 'page': 3}])
    assert text == '[n.pdf p.3] abc'
